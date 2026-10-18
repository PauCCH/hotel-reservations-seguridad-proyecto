"use server";

/**
 * @file lookupReservation.server.ts — Public "find my reservation" lookup.
 *
 * ⚠️ SECURITY COURSE PROJECT — CONTROLLED VULNERABILITY (OP-POC-1) ⚠️
 * Introduced deliberately per the team decision in
 * `docs/proyecto-seguridad/plan-desarrollo.md` §4.1, because the real code in
 * this module had no reachable injection sink (see finding O11 in
 * `docs/proyecto-seguridad/operations/fase-1-diagnostico.md`). The bug is the
 * opposite of `openGatewaySession` (§OP-C12 in the same diagnostic), which
 * does recompute values server-side instead of trusting client input.
 *
 * `reservations` has RLS enabled with NO policies (deny-all), so an
 * unauthenticated "find my reservation" feature has nothing to run the query
 * as *except* the service-role client — this mirrors how `galleryActions.ts`
 * and `reservationService.ts` already use the service client in this module.
 *
 * THE BUG: `code` and `email` are concatenated directly into a PostgREST
 * `.or()` filter string instead of using `.eq()` (parameterized) calls. Both
 * values are attacker-controlled; filter *syntax* (commas, operators) can
 * be injected, not just filter *values* — the OWASP A03 injection class for
 * PostgREST/Supabase query builders. Because every column is reachable in a
 * forged OR clause, this doubles as an A01 IDOR: an attacker who knows
 * nothing but this form can read every guest's PII and reservation data.
 *
 * DO NOT replicate this pattern. The Fase 3 fix (A3.1) must replace the
 * `.or()` string with parameterized `.eq()` filters — see the real-world
 * version of the same bug class at `getAuditLogs.ts:57` (Fabian's module,
 * F3.1) for the sibling fix.
 */

import { createSupabaseServiceClient, DB_COLUMNS, DB_TABLES } from "@hotel/db";
import type { ReservationLookupInput, ReservationLookupResult } from "../domain/types";

type RawReservationRow = {
  code: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  status: string;
  check_in: string;
  check_out: string;
  total_amount: number;
  currency: string;
};

export async function lookupReservation(
  input: ReservationLookupInput,
): Promise<ReservationLookupResult[]> {
  const supabase = createSupabaseServiceClient();
  const c = DB_COLUMNS.reservations;

  // VULNERABLE: unparameterized string concatenation into a PostgREST filter.
  // Should be `.eq(c.code, input.code).eq(c.guest_email, input.email)`.
  const filter = `${c.code}.ilike.%${input.code}%,${c.guest_email}.ilike.%${input.email}%`;

  const { data, error } = await supabase
    .from(DB_TABLES.RESERVATIONS)
    .select(
      `${c.code}, ${c.guest_name}, ${c.guest_email}, ${c.guest_phone}, ${c.status}, ${c.check_in}, ${c.check_out}, ${c.total_amount}, ${c.currency}`,
    )
    .or(filter)
    .limit(50);

  if (error || !data) return [];

  return (data as unknown as RawReservationRow[]).map((row) => ({
    code: row.code,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    guestPhone: row.guest_phone,
    status: row.status,
    checkIn: row.check_in,
    checkOut: row.check_out,
    totalAmount: row.total_amount,
    currency: row.currency,
  }));
}
