"use client";

/**
 * @fileoverview Client-side auth session service.
 *
 * Manages session subscription and auto-refresh
 * to keep client in sync with server.
 *
 * @deprecated Since P3.3 the session cookies are HttpOnly, so the browser client
 * never sees a session and these helpers always report "signed out". Read auth
 * state through Server Actions (`refreshSession` / `getAuthContextAction`) instead.
 *
 * @example
 * ```ts
 * import { getClientSession, subscribeToAuthChanges } from "@hotel/core/auth";
 *
 * const user = await getClientSession();
 * const subscription = subscribeToAuthChanges((user) => {
 *   console.log("Auth changed:", user);
 * });
 * ```
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Session, Subscription, User } from "@supabase/supabase-js";

/**
 * Creates a browser client for client-side auth.
 * Uses environment variables.
 */
function getSupabaseBrowserClient(): ReturnType<typeof createBrowserClient> {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * Gets current session from client.
 *
 * @returns Current user or null
 *
 * @example
 * ```ts
 * const user = await getClientSession();
 * ```
 */
export async function getClientSession(): Promise<User | null> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("[getClientSession] Error:", error.message);
    return null;
  }

  return session?.user ?? null;
}

/**
 * Subscribes to auth state changes.
 *
 * Automatically called on mount to keep client
 * in sync with server session changes.
 *
 * @param callback - Called when auth state changes
 * @returns Subscription to unsubscribe
 *
 * @example
 * ```ts
 * const subscription = subscribeToAuthChanges((user) => {
 *   setUser(user);
 * });
 *
 * return () => subscription.unsubscribe();
 * ```
 */
export function subscribeToAuthChanges(callback: (user: User | null) => void): Subscription {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
    callback(session?.user ?? null);
  });

  return subscription;
}

/**
 * Signs out from client.
 *
 * @example
 * ```ts
 * await signOutClient();
 * ```
 */
export async function signOutClient(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("[signOutClient] Error:", error.message);
    throw error;
  }
}
