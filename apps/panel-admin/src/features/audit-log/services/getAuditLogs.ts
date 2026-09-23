"use server";

import {
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
  getAuditRequestContext,
  logAuditEvent,
} from "@hotel/core/audit";
import { verifyAdminRole } from "@hotel/core/auth";
import { createSupabaseServerClient, createSupabaseServiceClient, DB_TABLES } from "@hotel/db";
import type { AuditLogEntry } from "@hotel/db/types";
import { cookies } from "next/headers";
import { AUDIT_LOG_PAGE_SIZE } from "@/features/audit-log/constants/pagination";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/shared/auth/errors";
import { PERMISSIONS } from "@/shared/constants/permissions";

export interface GetAuditLogsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  action?: string;
  from?: string;
  to?: string;
}

export interface GetAuditLogsResult {
  rows: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export const getAuditLogs = async (
  params: GetAuditLogsParams = {},
): Promise<GetAuditLogsResult> => {
  const cookieStore = await cookies();
  const {
    data: { session },
  } = await createSupabaseServerClient(cookieStore).auth.getSession();

  if (!session?.user) throw new AuthenticationRequiredError();

  const admin = await verifyAdminRole(session.user.id);
  if (!admin) throw new PermissionDeniedError(PERMISSIONS.AUDIT.VIEW);

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? AUDIT_LOG_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const supabase = createSupabaseServiceClient();
  let query = supabase.from(DB_TABLES.AUDIT_LOGS).select("*", { count: "exact" });

  if (params.action) query = query.eq("action", params.action);
  if (params.from) query = query.gte("created_at", params.from);
  if (params.to) query = query.lte("created_at", params.to);
  if (params.search) {
    query = query.or(`action.ilike.%${params.search}%,actor_email.ilike.%${params.search}%`);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) throw new Error(error.message);

  const { ipAddress, userAgent } = await getAuditRequestContext();

  await logAuditEvent({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: AUDIT_ACTIONS.AUDIT_LOG_VIEWED,
    entity: AUDIT_ENTITIES.AUDIT_LOGS,
    metadata: { page, pageSize, search: params.search ?? null, action: params.action ?? null },
    ipAddress,
    userAgent,
  });

  return { rows: (data ?? []) as AuditLogEntry[], total: count ?? 0, page, pageSize };
};
