"use server";

/**
 * @fileoverview Server-side session refresh action.
 *
 * Forces a session refresh from the server to ensure
 * client has latest session state.
 * Used by AuthProvider.refresh() to sync client state.
 *
 * @example
 * ```ts
 * // In client hook
 * const { refresh } = useAuth();
 * await refresh();
 * ```
 */

import { createSupabaseServerClient } from "@hotel/db";
import { cookies } from "next/headers";
import { verifyAdminRole } from "../index";
import type { AdminProfile, AuthState, ClientProfile } from "../shared/types";
import { getVerifiedSession } from "./getVerifiedSession";

/**
 * Server action: force refresh session from server.
 *
 * Gets latest session and profile from cookies.
 * Used by client to sync auth state after login.
 *
 * @returns AuthState with latest session/user/profile
 *
 * @example
 * ```ts
 * const authState = await refreshSession();
 * ```
 */
export async function refreshSession(): Promise<AuthState> {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  // getUser() verifies the JWT against Supabase Auth; getSession() alone does not (AUTH-POC-2).
  const { session, user } = await getVerifiedSession(supabase);

  let profile: AdminProfile | ClientProfile | null = null;
  let isAdmin = false;

  if (user) {
    const adminProfile = await verifyAdminRole(user.id);
    if (adminProfile) {
      profile = adminProfile as unknown as AdminProfile;
      isAdmin = true;
    }
  }

  return {
    session,
    user,
    profile,
    isAdmin,
    isLoading: false,
  };
}

/**
 * Alias for refreshSession.
 */
export const getAuthContextAction = refreshSession;
