"use server";

import { AUDIT_ACTIONS, getAuditRequestContext, logAuditEvent } from "@hotel/core/audit";
import { hasRole, verifyAdminRole } from "@hotel/core/auth";
import { createSupabaseServerClient, DB_COLUMNS, DB_ENUMS, DB_TABLES } from "@hotel/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";
import type { LoginActionState } from "@/features/auth/domain/credentials";

export async function loginAction(
  prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { ipAddress, userAgent } = await getAuditRequestContext();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    await logAuditEvent({
      actorEmail: email,
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
      metadata: { email, reason: error?.message ?? "Invalid credentials" },
      ipAddress,
      userAgent,
    });

    return { error: "INVALID_CREDENTIALS" };
  }

  const admin = await verifyAdminRole(data.user.id);

  if (!admin) {
    await supabase.auth.signOut();

    const { data: roleData } = await supabase
      .from(DB_TABLES.USER_ROLES)
      .select(DB_COLUMNS.user_roles.role)
      .eq(DB_COLUMNS.user_roles.user_id, data.user.id)
      .single();

    if (hasRole(roleData, [DB_ENUMS.user_role.admin, DB_ENUMS.user_role.owner])) {
      await logAuditEvent({
        actorId: data.user.id,
        actorEmail: data.user.email ?? email,
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
        metadata: { email, reason: "account_deactivated" },
        ipAddress,
        userAgent,
      });

      return { error: "ACCOUNT_DEACTIVATED" };
    }

    await logAuditEvent({
      actorId: data.user.id,
      actorEmail: data.user.email ?? email,
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
      metadata: { email, reason: "access_denied" },
      ipAddress,
      userAgent,
    });

    return { error: "ACCESS_DENIED" };
  }

  await logAuditEvent({
    actorId: data.user.id,
    actorEmail: data.user.email ?? email,
    action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
    metadata: { requireAdmin: true },
    ipAddress,
    userAgent,
  });

  redirect(ROUTES.ADMIN.DASHBOARD);
}
