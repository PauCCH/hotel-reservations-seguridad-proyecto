/**
 * @fileoverview Security response headers + nonce-based Content Security Policy (P3.2).
 *
 * Used by the middleware of every app. A fresh nonce is generated per request and
 * sent both on the request (Next.js reads the `Content-Security-Policy` request
 * header and stamps the nonce on its own inline/bootstrap scripts) and on the
 * response (what the browser enforces).
 *
 * `script-src` has no `'unsafe-inline'`: inline event handlers such as the
 * `onerror=` payload of AUTH-POC-4 and any injected `<script>` without the nonce
 * are blocked even if an HTML sink reappears.
 *
 * Edge-runtime safe: only Web Crypto / `btoa`, no Node APIs.
 *
 * @example
 * ```ts
 * const { requestHeaders, csp } = prepareSecurityHeaders(request.headers, { isDev });
 * const response = NextResponse.next({ request: { headers: requestHeaders } });
 * applySecurityHeaders(response.headers, csp);
 * ```
 */

export const CSP_HEADER = "Content-Security-Policy";
export const NONCE_HEADER = "x-nonce";

export interface CspOptions {
  /** Per-request nonce (base64). */
  nonce: string;
  /** Development mode: React needs `'unsafe-eval'` for call stacks. */
  isDev: boolean;
  /** Supabase project URL (REST, Auth, Storage, Realtime). */
  supabaseUrl?: string;
  /** Extra origins allowed in `img-src` (CDNs used by the app). */
  imgSrc?: readonly string[];
}

/** Returns a base64 nonce from 16 random bytes. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Builds the CSP header value. */
export function buildContentSecurityPolicy({
  nonce,
  isDev,
  supabaseUrl,
  imgSrc = [],
}: CspOptions): string {
  const supabase = originOf(supabaseUrl);
  const supabaseWs = supabase ? supabase.replace(/^http/, "ws") : null;

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    // Tailwind/HeroUI set inline `style` attributes; style injection cannot run script.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...(supabase ? [supabase] : []), ...imgSrc],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...(supabase ? [supabase] : []), ...(supabaseWs ? [supabaseWs] : [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");

  return isDev ? policy : `${policy}; upgrade-insecure-requests`;
}

/** Static hardening headers sent with every response. */
export function getSecurityHeaders(isDev: boolean): ReadonlyArray<readonly [string, string]> {
  return [
    ["X-Content-Type-Options", "nosniff"],
    ["X-Frame-Options", "DENY"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()"],
    ...(isDev
      ? []
      : ([["Strict-Transport-Security", "max-age=63072000; includeSubDomains"]] as const)),
  ];
}

export interface PrepareSecurityHeadersOptions {
  isDev: boolean;
  supabaseUrl?: string;
  imgSrc?: readonly string[];
}

/**
 * Creates the nonce + CSP for this request and returns request headers carrying
 * both, ready for `NextResponse.next({ request: { headers } })`.
 */
export function prepareSecurityHeaders(
  incoming: Headers,
  { isDev, supabaseUrl, imgSrc }: PrepareSecurityHeadersOptions,
): { requestHeaders: Headers; csp: string; nonce: string } {
  const nonce = createNonce();
  const csp = buildContentSecurityPolicy({ nonce, isDev, supabaseUrl, imgSrc });

  const requestHeaders = new Headers(incoming);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set(CSP_HEADER, csp);

  return { requestHeaders, csp, nonce };
}

/** Writes the CSP and the static hardening headers onto a response. */
export function applySecurityHeaders(headers: Headers, csp: string, isDev: boolean): void {
  headers.set(CSP_HEADER, csp);
  for (const [name, value] of getSecurityHeaders(isDev)) {
    headers.set(name, value);
  }
}
