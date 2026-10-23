"use server";

/**
 * @file sessionActions.ts — Server Actions for the portal's client-side auth state.
 *
 * Session cookies are HttpOnly since P3.3 (O-10), so the browser Supabase client
 * cannot read or clear them. The header/user store asks the server instead: the
 * user is verified with `getUser()` (AUTH-POC-2) and sign-out clears the cookies
 * from the server response.
 */

import { getVerifiedSession } from "@hotel/core/auth";
import { createSupabaseServerClient } from "@hotel/db";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** Returns the verified current user, or `null` when there is no valid session. */
export async function getSessionUserAction(): Promise<User | null> {
  const supabase = createSupabaseServerClient(await cookies());
  const { user } = await getVerifiedSession(supabase);
  return user;
}

/** Signs out and clears the HttpOnly session cookies. */
export async function signOutAction(): Promise<void> {
  const supabase = createSupabaseServerClient(await cookies());
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}
