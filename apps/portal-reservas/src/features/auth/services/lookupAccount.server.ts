"use server";

/**
 * @file lookupAccount.server.ts — Public "do I already have an account?" lookup.
 *
 * ⚠️ SECURITY COURSE PROJECT — CONTROLLED VULNERABILITY (AUTH-POC-3) ⚠️
 * Introduced deliberately per the team decision in
 * `docs/proyecto-seguridad/plan-desarrollo.md` §4.1, because the real auth code
 * had no reachable injection sink: every auth query goes through the Supabase
 * client with parameterized `.eq()` calls (see `packages/core/src/permissions`
 * and `signInWithPassword`), so the A03 half of Vector 1 (P2.1) had no real
 * finding to demonstrate. The strong, *real* findings for this vector are A01:
 * signup role escalation (AUTH-POC-1, O-02) and JWT-claim trust in RLS +
 * `getSession()` (AUTH-POC-2, O-05/O-11).
 *
 * This mirrors the controlled vulns already in the repo for the sibling
 * modules so the Fase 3 fix has the same shape:
 *   - Operations: `lookupReservation.server.ts` (OP-POC-1), fixed in A3.1.
 *   - Audit (real): `getAuditLogs.ts:57`, fixed in F3.1.
 *
 * THE BUG: `name` and `accountId` are concatenated directly into a PostgREST
 * `.or()` filter string instead of using parameterized `.eq()` / `.ilike()`
 * calls. Both values are attacker-controlled; filter *syntax* (commas,
 * operators) can be injected, not just filter *values* — the OWASP A03
 * injection class for PostgREST/Supabase query builders. Because any column is
 * reachable in a forged OR clause, this doubles as an A01 info-disclosure:
 * the form "find my own account" becomes "dump every profile", which leaks the
 * full_name / active state of every user and helps an attacker pick an admin
 * to target with AUTH-POC-1.
 *
 * `profiles` has RLS enabled; this public, pre-login feature runs under the
 * service-role client (same as `lookupReservation.server.ts`), so the forged
 * filter is evaluated against every row.
 *
 * DO NOT replicate this pattern. The Fase 3 fix (P3.1) must replace the `.or()`
 * string with parameterized `.eq()` / `.ilike()` filters.
 */

import { createSupabaseServiceClient, DB_COLUMNS, DB_TABLES } from "@hotel/db";

export interface AccountLookupInput {
  /** Full name the visitor types in the "find my account" form. */
  name: string;
  /** Optional account id hint from a recovery link. */
  accountId: string;
}

export interface AccountLookupResult {
  id: string;
  fullName: string | null;
  isActive: boolean;
}

type RawProfileRow = {
  id: string;
  full_name: string | null;
  is_active: boolean;
};

export async function lookupAccount(input: AccountLookupInput): Promise<AccountLookupResult[]> {
  const supabase = createSupabaseServiceClient();
  const c = DB_COLUMNS.profiles;

  // VULNERABLE: unparameterized string concatenation into a PostgREST filter.
  // Should be `.ilike(c.full_name, `%${input.name}%`).eq(c.id, input.accountId)`.
  const filter = `${c.full_name}.ilike.%${input.name}%,${c.id}.eq.${input.accountId}`;

  const { data, error } = await supabase
    .from(DB_TABLES.PROFILES)
    .select(`${c.id}, ${c.full_name}, ${c.is_active}`)
    .or(filter)
    .limit(50);

  if (error || !data) return [];

  return (data as unknown as RawProfileRow[]).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    isActive: row.is_active,
  }));
}
