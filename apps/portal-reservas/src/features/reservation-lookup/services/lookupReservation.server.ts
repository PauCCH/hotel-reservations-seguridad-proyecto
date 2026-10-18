"use server";

/**
 * @file lookupReservation.server.ts — Public "find my reservation" lookup.
 *
 * SECURITY COURSE PROJECT — Fase 3 patch for OP-POC-1 (A3.1).
 * This endpoint used to build its PostgREST filter by concatenating the
 * attacker-controlled `code`/`email` into a `.or()` string, which let a caller
 * inject filter *syntax* (an always-true OR clause) and dump every guest's PII
 * — an OWASP A03 injection that doubled as an A01 IDOR.
 *
 * THE FIX: both values are now bound through parameterized `.eq()` calls, which
 * PostgREST sends as literal equality values (never parsed as filter syntax).
 * The two conditions are AND'd, so a result is returned only when BOTH the
 * reservation code and the guest email match the row on file — i.e. only the
 * legitimate owner. This matches the sibling fix for the same bug class at
 * `getAuditLogs.ts` (Fabian's module, F3.1).
 *
 * `reservations` has RLS enabled with NO policies (deny-all), so this public
 * lookup still runs as the service-role client; least-privilege narrowing of
 * that access (scoped RLS / a SECURITY DEFINER function) is tracked separately.
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

  // FIXED (A3.1): parameterized equality filters. `input.code` / `input.email`
  // are bound as literal values, so they cannot inject filter syntax, and both
  // must match the same row (AND) — only the reservation's real owner matches.
  const { data, error } = await supabase
    .from(DB_TABLES.RESERVATIONS)
    .select(
      `${c.code}, ${c.guest_name}, ${c.guest_email}, ${c.guest_phone}, ${c.status}, ${c.check_in}, ${c.check_out}, ${c.total_amount}, ${c.currency}`,
    )
    .eq(c.code, input.code)
    .eq(c.guest_email, input.email)
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
