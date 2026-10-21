"use server";

import { AUTH_ROLES, getVerifiedSession } from "@hotel/core/auth";
import { getUserPermissions } from "@hotel/core/permissions";
import { createSupabaseServerClient, DB_COLUMNS, DB_TABLES } from "@hotel/db";
import type { PermissionName } from "@hotel/db/types";
import { cookies } from "next/headers";
import { AuthenticationRequiredError, PermissionDeniedError } from "./errors";

async function getCurrentUserId(): Promise<string> {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  // getUser() verifies the JWT against Supabase Auth; getSession() alone does not (AUTH-POC-2).
  const { user } = await getVerifiedSession(supabase);

  if (!user) {
    throw new AuthenticationRequiredError();
  }

  return user.id;
}

async function isOwner(userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data } = await supabase
    .from(DB_TABLES.USER_ROLES)
    .select(DB_COLUMNS.user_roles.role)
    .eq(DB_COLUMNS.user_roles.user_id, userId)
    .single();

  return data?.role === AUTH_ROLES.OWNER;
}

export async function requirePermission(permission: PermissionName): Promise<void> | never {
  const userId = await getCurrentUserId();

  // Owner bypasses all permission checks
  if (await isOwner(userId)) {
    return;
  }

  const permissions = await getUserPermissions(userId);

  if (!permissions.includes(permission)) {
    throw new PermissionDeniedError(permission);
  }
}

export async function requirePermissions(
  permissions: PermissionName[],
  requireAll = true,
): Promise<void> {
  const userId = await getCurrentUserId();

  // Owner bypasses all permission checks
  if (await isOwner(userId)) {
    return;
  }

  const userPermissions = await getUserPermissions(userId);

  const hasAccess = requireAll
    ? permissions.every((p) => userPermissions.includes(p))
    : permissions.some((p) => userPermissions.includes(p));

  if (!hasAccess) {
    throw new PermissionDeniedError(permissions[0]);
  }
}
