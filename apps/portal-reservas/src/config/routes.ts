/**
 * Application route constants — single source of truth for URL paths.
 *
 * Deeply frozen with `as const` and `Object.freeze` for compile-time safety.
 * Zero hardcoded route strings outside this file.
 *
 * Auth routes support the Supabase Auth flow:
 * - LOGIN/REGISTER: User-facing forms
 * - VERIFY_EMAIL: Post-registration email confirmation
 * - ERROR: Auth error display (e.g., invalid token, expired link)
 * - CALLBACK: Supabase OAuth/magic-link callback handler
 */
export const ROUTES = Object.freeze({
  HOME: "/",
  /** Reservation confirmation + guest details + payment hand-off (US-DM-06). */
  RESERVE: "/reserve",
  /** Post-payment success screen (US-DM-06). */
  RESERVE_SUCCESS: "/reserve/success",
  /** Public "find my reservation" lookup (security project OP-POC-1). */
  RESERVATIONS_LOOKUP: "/reservations/lookup",
  AUTH: Object.freeze({
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    VERIFY_EMAIL: "/auth/verify-email",
    ERROR: "/auth/error",
    CALLBACK: "/auth/callback",
  } as const),
  API: Object.freeze({
    /** Creates the payment-gateway checkout session (US-DM-06). */
    CHECKOUT: "/api/checkout",
    /** Public "find my reservation" lookup (security project OP-POC-1). */
    RESERVATIONS_LOOKUP: "/api/reservations/lookup",
  } as const),
} as const);
