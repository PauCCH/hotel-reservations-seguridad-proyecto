/**
 * @file checkoutSchema.ts — Server-side validation of the checkout payload.
 *
 * SECURITY COURSE PROJECT — Fase 3 patch for OP-POC-5 (A3.3). The checkout used
 * to persist whatever dates/guests the client sent, with no business-rule
 * validation (past dates, arbitrary capacity). This Zod schema is the strict
 * server-side gate: shape, date sanity (future, check-out after check-in) and a
 * positive guest count. Room-capacity and availability are enforced in
 * `gateway.server.ts`, where the resolved room catalog and the DB are available.
 */

import { z } from "zod";
import { CHECKOUT_VALIDATION } from "../constants/checkout.constants";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses a YYYY-MM-DD string to a local midnight Date, or null when invalid. */
function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Today at local midnight, so same-day check-in is allowed. */
function todayMidnight(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export const checkoutPayloadSchema = z
  .object({
    roomIds: z.array(z.string().min(1)).min(1),
    checkIn: z.string().regex(ISO_DATE),
    checkOut: z.string().regex(ISO_DATE),
    guests: z.number().int().min(1),
    email: z.string().email(),
    fullName: z.string().trim().min(CHECKOUT_VALIDATION.MIN_NAME_LENGTH),
    phone: z.string().trim().min(1),
    specialRequests: z.string().max(1000),
  })
  .refine(
    (data) => {
      const checkIn = parseIsoDate(data.checkIn);
      return checkIn !== null && checkIn >= todayMidnight();
    },
    { path: ["checkIn"], message: "check_in must be today or in the future" },
  )
  .refine(
    (data) => {
      const checkIn = parseIsoDate(data.checkIn);
      const checkOut = parseIsoDate(data.checkOut);
      return checkIn !== null && checkOut !== null && checkOut > checkIn;
    },
    { path: ["checkOut"], message: "check_out must be after check_in" },
  );

export type ValidatedCheckoutPayload = z.infer<typeof checkoutPayloadSchema>;
