/**
 * @file lookupAccount.server.test.ts — Regression test for AUTH-POC-3.
 *
 * Does NOT hit a real Supabase project. Mocks `@hotel/db` and asserts the exact
 * PostgREST `.or()` filter string the service builds, proving that
 * attacker-controlled `name`/`accountId` values are concatenated unescaped into
 * filter *syntax* (not just filter values) — the OWASP A03 injection class for
 * Supabase/PostgREST query builders. See `lookupAccount.server.ts` for the full
 * writeup and `docs/proyecto-seguridad/auth/fase-2-pocs.md` (AUTH-POC-3) for the
 * live reproduction.
 *
 * This test is expected to start FAILING once P3.1 replaces `.or()` with
 * parameterized `.eq()` / `.ilike()` filters — that is the regression signal
 * Fase 3 needs.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const orSpy = vi.fn();

vi.mock("@hotel/db", async () => {
  const actual = await vi.importActual<typeof import("@hotel/db")>("@hotel/db");

  const builder = {
    select: vi.fn(() => builder),
    or: vi.fn((filter: string) => {
      orSpy(filter);
      return builder;
    }),
    limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
  };

  return {
    ...actual,
    createSupabaseServiceClient: vi.fn(() => ({
      from: vi.fn(() => builder),
    })),
  };
});

import { lookupAccount } from "./lookupAccount.server";

describe("lookupAccount (AUTH-POC-3)", () => {
  beforeEach(() => {
    orSpy.mockClear();
  });

  it("concatenates the raw name and accountId into the .or() filter string", async () => {
    await lookupAccount({ name: "Ada Lovelace", accountId: "00000000-0000-0000-0000-000000000000" });

    expect(orSpy).toHaveBeenCalledWith(
      "full_name.ilike.%Ada Lovelace%,id.eq.00000000-0000-0000-0000-000000000000",
    );
  });

  it("lets an attacker inject additional PostgREST filter syntax via `name`", async () => {
    // Payload: closes the intended `full_name.ilike.%…%` value early with a
    // comma (PostgREST's OR-clause separator) and appends `is_active.eq.true`,
    // a condition that matches every active profile — turning "find my own
    // account" into "return every active profile".
    const injectedName = "a,is_active.eq.true";

    await lookupAccount({ name: injectedName, accountId: "none" });

    const sentFilter = orSpy.mock.calls[0][0] as string;
    expect(sentFilter).toBe("full_name.ilike.%a,is_active.eq.true%,id.eq.none");

    // The resulting PostgREST filter has three top-level OR'd conditions — the
    // injected `is_active.eq.true` matches every active profile regardless of
    // the name the attacker actually typed.
    const clauses = sentFilter.split(",");
    expect(clauses).toEqual(["full_name.ilike.%a", "is_active.eq.true%", "id.eq.none"]);
  });
});
