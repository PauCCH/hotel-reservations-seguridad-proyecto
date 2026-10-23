import { applySecurityHeaders, prepareSecurityHeaders } from "@hotel/core/security";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveLocale } from "@/lib/resolveLocale";

const IS_DEV = process.env.NODE_ENV === "development";

export function middleware(request: NextRequest) {
  const locale = resolveLocale(request);

  // Per-request nonce CSP + security headers (P3.2).
  const { requestHeaders, csp } = prepareSecurityHeaders(request.headers, {
    isDev: IS_DEV,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  requestHeaders.set("x-locale", locale);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  applySecurityHeaders(response.headers, csp, IS_DEV);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|api/).*)"],
};
