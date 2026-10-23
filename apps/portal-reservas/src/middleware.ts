/**
 * @file middleware.ts — Next.js middleware for portal-reservas.
 *
 * Runs on every non-static request to refresh the Supabase auth session.
 * This ensures the session token is always fresh when server components render,
 * preventing stale auth state in layouts and pages.
 *
 * The cookie adapter pattern bridges Next.js request/response cookies to Supabase:
 * - getAll(): reads cookies from the incoming request
 * - set(): writes cookies to the outgoing response (for token refresh)
 *
 * It also sets a per-request nonce Content Security Policy and the security
 * headers from `@hotel/core/security` (P3.2, AUTH-POC-4).
 *
 * Matcher excludes static assets (_next/static, _next/image, favicon, images).
 */

import { applySecurityHeaders, prepareSecurityHeaders } from "@hotel/core/security";
import { createSupabaseServerClient } from "@hotel/db";
import { type NextRequest, NextResponse } from "next/server";

const IS_DEV = process.env.NODE_ENV === "development";

export async function middleware(request: NextRequest) {
  const { requestHeaders, csp } = prepareSecurityHeaders(request.headers, {
    isDev: IS_DEV,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    imgSrc: ["https://images.unsplash.com"],
  });

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  applySecurityHeaders(response.headers, csp, IS_DEV);

  // Create a Supabase server client with cookie read/write support.
  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    set: (name, value, options) => response.cookies.set(name, value, options),
  });

  // Refresh the session if needed — this updates the auth token cookie.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - image files (svg, png, jpg, jpeg, gif, webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
