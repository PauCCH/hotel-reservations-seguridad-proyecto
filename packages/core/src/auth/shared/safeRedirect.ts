/**
 * @fileoverview Open-redirect guard for post-auth redirects (AUTH-POC-5 fix, P3.3).
 *
 * `callbackUrl` comes from the query string / a hidden form field, so it is
 * attacker-controlled. `new URL(value, origin)` and Next's `redirect()` both
 * follow absolute (`https://evil.example`) and protocol-relative
 * (`//evil.example`) values off-site. Only same-origin paths are accepted.
 *
 * Client-safe (no Node/Next APIs).
 */

/** Placeholder origin used only to parse/normalise the path. */
const INTERNAL_ORIGIN = "http://internal.invalid";
const MAX_REDIRECT_LENGTH = 2048;

/**
 * Returns `value` as a normalised same-origin path (`/path?query#hash`), or
 * `fallback` when it is missing or could leave the site.
 *
 * Rejected: absolute URLs, protocol-relative `//host`, backslash tricks
 * (`/\host`, which browsers treat as `//host`), control characters (the URL
 * parser drops tab/CR/LF, turning `/\t/host` into `//host`) and paths that
 * normalise to `//host` (e.g. `/..//host`).
 *
 * @example
 * ```ts
 * resolveSafeRedirectPath("/reserve?room=1", "/"); // "/reserve?room=1"
 * resolveSafeRedirectPath("https://evil.example", "/"); // "/"
 * ```
 */
export function resolveSafeRedirectPath(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;

  const candidate = value.trim();
  if (
    candidate.length === 0 ||
    candidate.length > MAX_REDIRECT_LENGTH ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  let url: URL;
  try {
    url = new URL(candidate, INTERNAL_ORIGIN);
  } catch {
    return fallback;
  }

  if (url.origin !== INTERNAL_ORIGIN) return fallback;

  const path = `${url.pathname}${url.search}${url.hash}`;
  return path.startsWith("//") ? fallback : path;
}
