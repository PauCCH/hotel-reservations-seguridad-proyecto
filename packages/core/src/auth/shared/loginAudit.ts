/**
 * @fileoverview Audit fields for login attempts (AUTH-POC-6 fix, P3.4).
 *
 * The login form is public, so the typed email and the provider's error text are
 * attacker-controlled. Fase 2 logged them verbatim and used the typed email as
 * `actor_email`, which let anyone forge entries attributed to another account
 * (e.g. typing `owner@hotel.local`) or write free text into the trail.
 *
 * Rules applied here (Fabian's `logAuditEvent` still strips control characters at
 * write time as a second layer):
 *   - A failed attempt has no actor: the typed email goes to
 *     `metadata.attempted_email`, and only if it is a well-formed address.
 *   - The actor (`actorId` / `actorEmail`) is set only from a user that Supabase
 *     already authenticated.
 *   - The failure reason is a closed code, never the provider's raw message.
 *
 * Client-safe (no Node/Next APIs).
 */

import type { AuditMetadata } from "../../audit";

export const LOGIN_FAILURE_REASONS = Object.freeze({
  INVALID_CREDENTIALS: "invalid_credentials",
  EMAIL_NOT_CONFIRMED: "email_not_confirmed",
  RATE_LIMITED: "rate_limited",
  ACCOUNT_DEACTIVATED: "account_deactivated",
  ACCESS_DENIED: "access_denied",
  UNKNOWN: "unknown",
} as const);

export type LoginFailureReason = (typeof LOGIN_FAILURE_REASONS)[keyof typeof LOGIN_FAILURE_REASONS];

const MAX_EMAIL_LENGTH = 254;
// Conservative shape check: no whitespace/control characters, quotes, angle
// brackets or separators that could be used to fake log structure.
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

/** Returns the lower-cased email if it is well formed, otherwise `null`. */
export function normalizeLoginEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return null;

  return EMAIL_PATTERN.test(email) ? email : null;
}

/** Maps a Supabase auth error to a closed reason code (never its message). */
export function loginFailureReasonFromAuthError(
  error: { code?: string | null; status?: number | null } | null | undefined,
): LoginFailureReason {
  switch (error?.code) {
    case "invalid_credentials":
      return LOGIN_FAILURE_REASONS.INVALID_CREDENTIALS;
    case "email_not_confirmed":
      return LOGIN_FAILURE_REASONS.EMAIL_NOT_CONFIRMED;
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return LOGIN_FAILURE_REASONS.RATE_LIMITED;
    default:
      return error?.status === 429
        ? LOGIN_FAILURE_REASONS.RATE_LIMITED
        : LOGIN_FAILURE_REASONS.UNKNOWN;
  }
}

/** Metadata for a failed login where no user was authenticated (no actor). */
export function buildFailedLoginMetadata(
  rawEmail: unknown,
  reason: LoginFailureReason,
): AuditMetadata {
  const attemptedEmail = normalizeLoginEmail(rawEmail);
  return {
    reason,
    attempted_email: attemptedEmail,
    attempted_email_valid: attemptedEmail !== null,
  };
}
