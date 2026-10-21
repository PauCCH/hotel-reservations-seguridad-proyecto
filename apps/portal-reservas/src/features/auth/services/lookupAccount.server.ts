"use server";

/**
 * @file lookupAccount.server.ts — Public "do I already have an account?" lookup.
 *
 * SECURITY COURSE PROJECT — AUTH-POC-3 (introduced in Fase 2, per plan §4.1),
 * FIXED in P3.1.
 *
 * THE BUG (Fase 2): `name` and `accountId` were concatenated into a PostgREST
 * `.or()` filter string, so an attacker controlled the filter *syntax*
 * (e.g. `name = "a,is_active.eq.true"`) and could dump every profile through the
 * service-role client (OWASP A03 + A01).
 *
 * THE FIX (root cause, same shape as A3.1 in `lookupReservation.server.ts`):
 *   1. No filter strings: the only filter is a parameterized `.eq()` on the id,
 *      so user input is bound as a value and can never become syntax.
 *   2. `accountId` must be a UUID; anything else is rejected before querying.
 *   3. The name is compared in code (case-insensitive, exact) instead of with
 *      `ilike`, so `%` / `_` / `*` wildcards cannot widen the match.
 *   4. At most one row can come back: the account whose id AND name both match.
 */

import { createSupabaseServiceClient, DB_COLUMNS, DB_TABLES } from "@hotel/db";

export interface AccountLookupInput {
  /** Full name the visitor types in the "find my account" form. */
  name: string;
  /** Account id hint from a recovery link. */
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME_LENGTH = 200;

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export async function lookupAccount(input: AccountLookupInput): Promise<AccountLookupResult[]> {
  const name = normalizeName(String(input.name ?? ""));
  const accountId = String(input.accountId ?? "").trim();

  if (!name || name.length > MAX_NAME_LENGTH || !UUID_PATTERN.test(accountId)) return [];

  const supabase = createSupabaseServiceClient();
  const c = DB_COLUMNS.profiles;

  // FIXED (P3.1): parameterized equality filter; `accountId` is bound as a value.
  const { data, error } = await supabase
    .from(DB_TABLES.PROFILES)
    .select(`${c.id}, ${c.full_name}, ${c.is_active}`)
    .eq(c.id, accountId)
    .maybeSingle();

  if (error || !data) return [];

  const row = data as unknown as RawProfileRow;
  if (!row.full_name || normalizeName(row.full_name) !== name) return [];

  return [{ id: row.id, fullName: row.full_name, isActive: row.is_active }];
}
