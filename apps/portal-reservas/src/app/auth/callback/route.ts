/**
 * @file route.ts — Supabase OAuth/magic-link callback Route Handler.
 *
 * Processes the authentication callback from Supabase (e.g., after OAuth redirect
 * or magic-link click). The flow:
 *
 * 1. Extract the `code` query parameter from the URL.
 * 2. If a code exists, exchange it for a full session via `exchangeCodeForSession()`.
 * 3. On success: redirect to the `callbackUrl` param (if it is a same-origin path) or home.
 * 4. On failure (no code, or exchange error): redirect to the auth error page.
 *
 * This route is configured as the redirect URL in Supabase Auth settings
 * and in the OAuth/magic-link flows.
 */

import { resolveSafeRedirectPath } from "@hotel/core/auth";
import { createSupabaseServerClient } from "@hotel/db";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { ROUTES } from "@/config/routes";
import { CALLBACK_SEARCH_PARAMS } from "@/features/auth/constants/callback-search-params";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get(CALLBACK_SEARCH_PARAMS.CODE);

  if (code) {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    // Exchange the temporary code for a full session — this sets the auth cookies.
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Success: redirect to the callback URL (from "redirect after login" flow) or home.
      // AUTH-POC-5 (P3.3): only same-origin paths; absolute or `//host` values fall back to home.
      const callbackUrl = resolveSafeRedirectPath(
        searchParams.get(CALLBACK_SEARCH_PARAMS.CALLBACK_URL),
        ROUTES.HOME,
      );
      return NextResponse.redirect(new URL(callbackUrl, origin));
    }
  }

  // Failure: no code or exchange error — redirect to auth error page.
  return NextResponse.redirect(new URL(ROUTES.AUTH.ERROR, origin));
}
