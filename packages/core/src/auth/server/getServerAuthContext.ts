"use server";

/**
 * @fileoverview Server-side SSR hydration for auth context.
 *
 * Fetches session, user, and profile from cookies on the server
 * to ensure client receives hydrated auth state on first render.
 * This fixes the null-session-on-first-render bug.
 *
 * @example
 * ```ts
 * // In RootLayout server component
 * import { getServerAuthContext } from "@hotel/core/auth";
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
 */

import { createSupabaseServerClient } from "@hotel/db";
import type { Session } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { verifyAdminRole } from "../index";
import type { AdminProfile, AuthState, ClientProfile } from "../shared/types";
import { getVerifiedSession } from "./getVerifiedSession";

/**
 * Cookie store interface for server clients.
 */
export type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * Server auth context returned for SSR hydration.
 *
 * Guarantees non-null after login when session is active.
 */
export interface ServerAuthContext {
  session: Session | null;
  user: Session["user"] | null;
  profile: AdminProfile | ClientProfile | null;
  isAdmin: boolean;
}

/**
 * Fetches session, user, and profile from server cookies.
 *
 * This should be called in RootLayout (server component)
 * to hydrate the client AuthProvider with initial auth state.
 *
 * @param cookieStore - Optional cookie store (defaults to next/headers)
 * @returns ServerAuthContext with session/user/profile
 *
 * @example
 * ```ts
 * const { session, user, profile, isAdmin } = await getServerAuthContext();
 * ```
 */
export async function getServerAuthContext(cookieStore?: CookieStore): Promise<ServerAuthContext> {
  const store = cookieStore ?? (await cookies());
  const supabase = createSupabaseServerClient(store);

  // getUser() verifies the JWT against Supabase Auth; getSession() alone does not (AUTH-POC-2).
  const { session, user } = await getVerifiedSession(supabase);

  // Fetch profile based on user existence
  let profile: AdminProfile | ClientProfile | null = null;
  let isAdmin = false;

  if (user) {
    const adminProfile = await verifyAdminRole(user.id);
    if (adminProfile) {
      profile = adminProfile as unknown as AdminProfile;
      isAdmin = adminProfile !== null;
    }
  }

  return {
    session,
    user,
    profile,
    isAdmin,
  };
}

/**
 * Alias for getServerAuthContext for backwards compatibility.
 *
 * @deprecated Use getServerAuthContext instead
 */
export const getInitialAuthStatus = getServerAuthContext;
