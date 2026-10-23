import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { DB_ENV } from "./config/env";
import type { Database } from "./database.types";

/**
 * Session cookie flags (P3.3, finding O-10). `HttpOnly` keeps the access/refresh
 * tokens out of reach of page JavaScript (and of any XSS); `Secure` in production
 * (local dev runs on http://localhost); `SameSite=Lax` limits cross-site sends.
 * Because of `HttpOnly`, the browser client cannot see the session: authenticated
 * reads/writes must go through Server Actions / route handlers.
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

export function createSupabaseServerClient(cookieStore: {
  getAll: () => { name: string; value: string }[];
  set: (name: string, value: string, options?: object) => void;
}) {
  return createServerClient<Database>(DB_ENV.SUPABASE_URL, DB_ENV.SUPABASE_ANON_KEY, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookies) =>
        cookies.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Ignored: setAll is called from Server Components where cookies are read-only.
          }
        }),
    },
  });
}

// For client-side usage in browser context only. It does NOT see the session (HttpOnly
// cookies): use it only for public reads and the OAuth redirect (PKCE verifier).
export function createSupabaseClient() {
  return createBrowserClient<Database>(DB_ENV.SUPABASE_URL, DB_ENV.SUPABASE_ANON_KEY);
}

// For Server Actions that don't need to read/write session cookies (e.g. signUp, signIn flows).
export function createSupabaseServerActionClient() {
  return createServerClient<Database>(DB_ENV.SUPABASE_URL, DB_ENV.SUPABASE_ANON_KEY, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

export type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;

// Uses the service role key — never call from the browser.
export function createSupabaseServiceClient() {
  return createServerClient<Database>(DB_ENV.SUPABASE_URL, DB_ENV.SUPABASE_SERVICE_ROLE_KEY, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
