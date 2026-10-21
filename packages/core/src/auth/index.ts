/**
 * @fileoverview Auth package for @hotel/core.
 *
 * Unified authentication layer for both panel-admin and portal-reservas.
 * Guarantees non-null session/user/profile after login.
 *
 * @example
 * ```ts
 * // Server component (layout.tsx)
 * import { getServerAuthContext, AuthProvider } from "@hotel/core/auth";
 *
 * const { session, user, profile, isAdmin } = await getServerAuthContext();
 *
 * return (
 *   <AuthProvider
 *     initialSession={session}
 *     initialUser={user}
 *     initialProfile={profile}
 *     initialIsAdmin={isAdmin}
 *   >
 *     {children}
 *   </AuthProvider>
 * );
 * ```
 *
 * @example
 * ```ts
 * // Client component
 * import { useAuth } from "@hotel/core/auth";
 *
 * const { session, user, profile, loading, refresh } = useAuth();
 * ```
 */

import type { AdminUser, SupabaseServerClient } from "@hotel/db";
import {
  createSupabaseServerActionClient,
  createSupabaseServiceClient,
  DB_COLUMNS,
  DB_ENUMS,
  DB_TABLES,
  RPC_FUNCTIONS,
} from "@hotel/db";
import { getUserPermissions } from "../permissions";
import type { ActivationErrorCode } from "./config/constants";
import { ACTIVATION_ERROR_CODES, AUTH_COLUMNS, AUTH_ROLES, AUTH_TABLE } from "./config/constants";
import { hasRole } from "./shared/utils";

// ============================================================================
// Re-exported types from shared/
// ============================================================================

export type { UseAuthSessionResult } from "./client/useAuthSession";

export type {
  CookieStore,
  LoginActionOptions,
  ServerAuthContext,
  SignOutOptions,
  SignOutResult,
} from "./server/types";

export type {
  AdminProfile,
  AuthContextValue,
  AuthError,
  AuthProviderProps,
  AuthState,
  ClientProfile,
  LoginResult,
  Session,
  SupabaseUser,
} from "./shared/types";

// ============================================================================
// Re-export server functions
// ============================================================================

export { getInitialAuthStatus, getServerAuthContext } from "./server/getServerAuthContext";
export { loginAction, loginFormAction } from "./server/loginAction";
export { getAuthContextAction, refreshSession } from "./server/refreshSession";
export type { VerifiedSession } from "./server/getVerifiedSession";
export { getVerifiedSession } from "./server/getVerifiedSession";
export { redirectToLogin, signOutAction } from "./server/signOutAction";

// ============================================================================
// Re-export client functions
// ============================================================================

export { AuthProvider, useAuth, withAuth } from "./client/AuthProvider";
export {
  getClientSession,
  signOutClient,
  subscribeToAuthChanges,
} from "./client/authSessionService";
export { useAuthSession } from "./client/useAuthSession";

// ============================================================================
// Re-export utils
// ============================================================================

// Re-export constants
export { AUTH_ROLES } from "./config/constants";
export {
  createAuthError,
  getRedirectUrl,
  getUserId,
  hasRole,
  isAdminUser,
  isSessionValid,
  validateProfile,
} from "./shared/utils";

// ============================================================================
// Original auth helpers (server-side only)
// ============================================================================

export type RegisterPayload = {
  email: string;
  password: string;
  full_name: string;
};

export type AuthErrorOld =
  | { code: "EMAIL_ALREADY_REGISTERED" }
  | { code: "UNKNOWN_ERROR"; message: string };

/**
 * Sign in with email and password.
 * @deprecated Use loginAction instead for unified login with profile fetch.
 */
export async function signInWithPassword(email: string, password: string) {
  const supabase = createSupabaseServerActionClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Sign out the current user.
 * @deprecated Use signOutAction instead.
 */
export async function signOut() {
  const supabase = createSupabaseServerActionClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

/**
 * Get current session.
 * @deprecated Use getServerAuthContext (server) or refreshSession (client).
 */
export async function getSession() {
  const supabase = createSupabaseServerActionClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Register a new user.
 */
export async function signUp(
  payload: RegisterPayload,
  supabase: SupabaseServerClient,
  redirectUrl?: string,
): Promise<{ success: true }> {
  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        full_name: payload.full_name,
        phone: null,
      },
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) {
    if (error.code === "user_already_exists") {
      throw { code: "EMAIL_ALREADY_REGISTERED" } satisfies AuthErrorOld;
    }
    throw { code: "UNKNOWN_ERROR", message: error.message } satisfies AuthErrorOld;
  }

  const userId = data.user?.id;
  if (!userId) {
    throw { code: "UNKNOWN_ERROR", message: "User creation returned no ID" } satisfies AuthErrorOld;
  }

  if (!data.user?.identities || data.user.identities.length === 0) {
    throw { code: "EMAIL_ALREADY_REGISTERED" } satisfies AuthErrorOld;
  }

  return { success: true };
}

/**
 * Invite a new admin by email.
 *
 * The admin role is granted server-side via `promote_invited_admin` (service-role
 * only), never through `user_metadata`: the signup trigger ignores
 * `raw_user_meta_data.role` since AUTH-POC-1 (P3.1).
 */
export async function inviteAdminByEmail(
  email: string,
  redirectTo: string,
  full_name?: string,
): Promise<{ id: string; email: string }> {
  const supabase = createSupabaseServiceClient();
  const options: { redirectTo: string; data?: { full_name: string } } = {
    redirectTo,
  };
  if (full_name) {
    options.data = { full_name };
  }
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, options);
  if (error) throw new Error(error.message);
  if (!data?.user) throw new Error("Invitation returned no user");

  const { error: promoteError } = await supabase.rpc(RPC_FUNCTIONS.PROMOTE_INVITED_ADMIN, {
    p_user_id: data.user.id,
  });
  if (promoteError) throw new Error(promoteError.message);

  return { id: data.user.id, email: data.user.email ?? email };
}

/**
 * Create an admin account by sending an invitation and recording it in pending_invitations.
 */
export async function createAdminAccount(
  email: string,
  redirectTo: string,
  full_name?: string,
): Promise<void> {
  const response = await inviteAdminByEmail(email, redirectTo, full_name);

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from(DB_TABLES.PENDING_INVITATIONS)
    .insert({ email: response.email, user_id: response.id });

  if (error) {
    console.error("Failed to record invitation:", error.message);
  }
}

export type ActivationTokenResult =
  | { userId: string; email: string }
  | { error: ActivationErrorCode };

/**
 * Verify activation token from email.
 */
export async function verifyActivationToken(
  accessToken: string,
  refreshToken: string,
): Promise<ActivationTokenResult> {
  const supabase = createSupabaseServerActionClient();
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data.user) {
    return { error: ACTIVATION_ERROR_CODES.INVALID_TOKEN };
  }

  return { userId: data.user.id, email: data.user.email ?? "" };
}

/**
 * Complete admin activation (set password and role).
 */
export async function completeAdminActivation(
  accessToken: string,
  refreshToken: string,
  password: string,
): Promise<void> {
  const supabase = createSupabaseServerActionClient();

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError || !sessionData.user) {
    throw new Error(ACTIVATION_ERROR_CODES.INVALID_OR_EXPIRED_TOKEN);
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) throw new Error(updateError.message);

  const serviceClient = createSupabaseServiceClient();
  // const { error: roleError } = await serviceClient
  //   .from(DB_TABLES.USER_ROLES)
  //   .update({ role: "admin" })
  //   .eq("user_id", sessionData.user.id);

  const { error: activationError } = await serviceClient
    .from(DB_TABLES.PROFILES)
    .update({ is_active: true })
    .eq(AUTH_COLUMNS.ID, sessionData.user.id);

  // if (roleError) throw new Error(roleError.message);
  if (activationError) throw new Error(activationError.message);

  // Mark pending_invitation as accepted by user_id
  await serviceClient
    .from(DB_TABLES.PENDING_INVITATIONS)
    .update({ status: DB_ENUMS.invitation_status.accepted, accepted_at: new Date().toISOString() })
    .eq(DB_COLUMNS.pending_invitations.user_id, sessionData.user.id)
    .eq(DB_COLUMNS.pending_invitations.status, DB_ENUMS.invitation_status.pending);
}

/**
 * Verify if user has admin role and is active.
 *
 * @example
 * ```ts
 * const admin = await verifyAdminRole(userId);
 * if (!admin) {
 *   throw new Error("Admin access required");
 * }
 * ```
 */
export async function verifyAdminRole(userId: string): Promise<AdminUser | null> {
  const supabase = createSupabaseServiceClient();

  const { data: profileData, error: profileError } = await supabase
    .from(AUTH_TABLE)
    .select(`${AUTH_COLUMNS.ID}, ${AUTH_COLUMNS.IS_ACTIVE}, full_name`)
    .eq(AUTH_COLUMNS.ID, userId)
    .single();

  const { data: roleData, error: roleError } = await supabase
    .from(DB_TABLES.USER_ROLES)
    .select(`${DB_COLUMNS.user_roles.role}, ${DB_COLUMNS.user_roles.user_id}`)
    .eq(DB_COLUMNS.user_roles.user_id, userId)
    .single();

  if (profileError) throw new Error(profileError.message);
  if (roleError) throw new Error(roleError.message);

  if (hasRole(roleData, [AUTH_ROLES.ADMIN, AUTH_ROLES.OWNER]) && profileData.is_active) {
    let permissions: string[] | undefined;
    try {
      if (roleData.role === AUTH_ROLES.OWNER) {
        permissions = Object.values(DB_ENUMS.user_permission);
      } else {
        permissions = await getUserPermissions(userId);
      }
    } catch {
      // If permissions can't be fetched, don't break backward compatibility
      permissions = undefined;
    }

    return { ...profileData, role: roleData.role, permissions } as AdminUser;
  }

  return null;
}
