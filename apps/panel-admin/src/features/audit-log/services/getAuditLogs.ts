"use server";

import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "@hotel/core/audit";
import { getAuditRequestContext, logAuditEvent } from "@hotel/core/audit/server";
import { verifyAdminRole } from "@hotel/core/auth";
import { createSupabaseServerClient, createSupabaseServiceClient, DB_TABLES } from "@hotel/db";
import type { AuditLogEntry } from "@hotel/db/types";
import { cookies } from "next/headers";
import {
  sanitizeAction,
  sanitizeDate,
  sanitizePage,
  sanitizePageSize,
  sanitizeSearch,
} from "@/features/audit-log/utils/sanitizeAuditLogParams";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/shared/auth/errors";
import { requirePermission } from "@/shared/auth/requirePermission";
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

  await requirePermission(PERMISSIONS.AUDIT.VIEW);

  const page = sanitizePage(params.page);
  const pageSize = sanitizePageSize(params.pageSize);
  const search = sanitizeSearch(params.search);
  const action = sanitizeAction(params.action);
  const from = sanitizeDate(params.from);
  const to = sanitizeDate(params.to);
  const offset = (page - 1) * pageSize;

  const supabase = createSupabaseServiceClient();
  let query = supabase.from(DB_TABLES.AUDIT_LOGS).select("*", { count: "exact" });

  if (action) query = query.eq("action", action);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  if (search) {
    // `search` only contains allowlisted characters, so it cannot close the
    // pattern or introduce extra PostgREST conditions.
    query = query.or(`action.ilike.%${search}%,actor_email.ilike.%${search}%`);
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
    metadata: { page, pageSize, search: search ?? null, action: action ?? null },
    ipAddress,
    userAgent,
  });

  return { rows: (data ?? []) as AuditLogEntry[], total: count ?? 0, page, pageSize };
};
