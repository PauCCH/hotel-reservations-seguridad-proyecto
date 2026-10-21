import { applySecurityHeaders, prepareSecurityHeaders } from "@hotel/core/security";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
  DB_COLUMNS,
  DB_TABLES,
} from "@hotel/db";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ROUTES } from "@/config/routes";
import { LOGIN_FORM_ERROR_KEYS } from "./features/auth/constants/loginFormErrorKeys";
import { LOGIN_FORM_SEARCH_PARAMS } from "./features/auth/constants/loginFormSearchParams";

const IS_DEV = process.env.NODE_ENV === "development";
const PROTECTED_PREFIX = "/admin";

export async function middleware(request: NextRequest) {
  // Per-request nonce CSP + security headers on every page, including /auth/* (P3.2).
  const { requestHeaders, csp } = prepareSecurityHeaders(request.headers, {
    isDev: IS_DEV,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  const secured = (response: NextResponse) => {
    applySecurityHeaders(response.headers, csp, IS_DEV);
    return response;
  };

  const isProtected =
    request.nextUrl.pathname === PROTECTED_PREFIX ||
    request.nextUrl.pathname.startsWith(`${PROTECTED_PREFIX}/`);

  const supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  if (!isProtected) {
    return secured(supabaseResponse);
  }

  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    set: (name, value, options) => {
      request.cookies.set(name, value);
      supabaseResponse.cookies.set(name, value, options);
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return secured(NextResponse.redirect(new URL(ROUTES.AUTH.LOGIN, request.url)));
  }

  // Check if the admin account has been deactivated
  const serviceClient = createSupabaseServiceClient();
  const { data: profile } = await serviceClient
    .from(DB_TABLES.PROFILES)
    .select(DB_COLUMNS.profiles.is_active)
    .eq("id", user.id)
    .single();

  if (profile && !profile.is_active) {
    const loginUrl = new URL(ROUTES.AUTH.LOGIN, request.url);
    loginUrl.searchParams.set(
      LOGIN_FORM_SEARCH_PARAMS.ERROR,
      LOGIN_FORM_ERROR_KEYS.ACCOUNT_DEACTIVATED,
    );
    return secured(NextResponse.redirect(loginUrl));
  }

  return secured(supabaseResponse);
}

export const config = {
  matcher: [
    // Every route except static assets, so /auth/* also gets the CSP.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
