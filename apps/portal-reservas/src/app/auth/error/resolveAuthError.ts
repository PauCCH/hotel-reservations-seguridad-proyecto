/**
 * @file resolveAuthError.ts — Maps the `/auth/error` query string to a known error key.
 *
 * SECURITY COURSE PROJECT — AUTH-POC-4 fix (P3.2) and finding O-04.
 *
 * Fase 2 rendered the attacker-controlled `error_description` as HTML
 * (`dangerouslySetInnerHTML`) → reflected XSS. Rendering it as JSX text would stop
 * script execution but still let a crafted link put arbitrary text on a trusted
 * page (O-04, phishing). The root-cause fix is to never reflect the query values:
 *   - `error_description` is ignored entirely.
 *   - `error` is only used to pick one entry from a closed allowlist; anything
 *     else becomes `UNKNOWN_ERROR`.
 * The page then shows translated, app-owned copy only.
 *
 * Kept free of the `@/` path alias so its regression test runs under vitest.
 */

import type { AuthErrorSearchParams } from "./page.interface";

/** Matches `CALLBACK_SEARCH_PARAMS.ERROR`. */
const ERROR_PARAM = "error";

/** Error keys that have translated copy in `t.AUTH.ERRORS`. */
export const AUTH_ERROR_KEYS = [
  "EMAIL_ALREADY_REGISTERED",
  "EMAIL_NOT_CONFIRMED",
  "EMAIL_RATE_LIMIT_REACHED",
  "INVALID_CREDENTIALS",
  "UNKNOWN_ERROR",
] as const;

export type AuthErrorKey = (typeof AUTH_ERROR_KEYS)[number];

const KNOWN_KEYS: ReadonlySet<string> = new Set(AUTH_ERROR_KEYS);

/**
 * Returns the allowlisted error key for the `error` query param, or
 * `UNKNOWN_ERROR` when it is missing, repeated or not a known code.
 */
export function resolveAuthErrorKey(searchParams: AuthErrorSearchParams | undefined): AuthErrorKey {
  const raw = searchParams?.[ERROR_PARAM];
  if (typeof raw !== "string") return "UNKNOWN_ERROR";

  const key = raw.trim().toUpperCase();
  return KNOWN_KEYS.has(key) ? (key as AuthErrorKey) : "UNKNOWN_ERROR";
}
