/**
 * @file reservation-lookup.constants.ts — Validation constants for the lookup form.
 */

export const LOOKUP_VALIDATION = {
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  CODE_PATTERN: /^RES-\d{1,6}$/,
} as const;
