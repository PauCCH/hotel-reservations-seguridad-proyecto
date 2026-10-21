/**
 * @fileoverview Server-side session read with JWT verification (AUTH-POC-2 fix, P3.1).
 *
 * `auth.getSession()` only decodes the cookie; it does not check the token against
 * Supabase Auth, so it must not drive authorization on the server. `auth.getUser()`
 * validates the JWT with GoTrue. The session object is still read afterwards so
 * the client can be hydrated with its tokens, but its `user` is replaced by the
 * verified one.
 *
 * Intentionally NOT a "use server" module: exporting it from one would turn it
 * into a public Server Action.
 */

import type { SupabaseServerClient } from "@hotel/db";
import type { Session, User } from "@supabase/supabase-js";

export interface VerifiedSession {
  session: Session | null;
  user: User | null;
}

const ANONYMOUS: VerifiedSession = { session: null, user: null };

/**
 * Returns the current user verified against Supabase Auth, or nulls when there is
 * no valid session (missing, expired, forged or revoked token).
 */
export async function getVerifiedSession(supabase: SupabaseServerClient): Promise<VerifiedSession> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    if (userError && userError.name !== "AuthSessionMissingError") {
      console.error("[getVerifiedSession] User verification failed:", userError.message);
    }
    return ANONYMOUS;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session ? { ...sessionData.session, user: userData.user } : null;

  return { session, user: userData.user };
}
