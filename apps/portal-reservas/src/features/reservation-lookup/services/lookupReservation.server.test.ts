/**
 * @file lookupReservation.server.test.ts — Regression test for OP-POC-1.
 *
 * Does NOT hit a real Supabase project. Mocks `@hotel/db` and asserts the
 * exact PostgREST `.or()` filter string the service builds, proving that
 * attacker-controlled `code`/`email` values are concatenated unescaped into
 * filter *syntax* (not just filter values) — the OWASP A03 injection class
 * for Supabase/PostgREST query builders. See `lookupReservation.server.ts`
 * for the full writeup and `docs/proyecto-seguridad/operations/fase-2-pocs.md`
 * (OP-POC-1) for the live reproduction over HTTP.
 *
 * This test is expected to start FAILING once A3.1 replaces `.or()` with
 * parameterized `.eq()` filters — that is the regression signal Fase 3 needs.
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

import { lookupReservation } from "./lookupReservation.server";

describe("lookupReservation (OP-POC-1)", () => {
  beforeEach(() => {
    orSpy.mockClear();
  });

  it("concatenates the raw code and email into the .or() filter string", async () => {
    await lookupReservation({ code: "RES-001", email: "guest@example.com" });

    expect(orSpy).toHaveBeenCalledWith(
      "code.ilike.%RES-001%,guest_email.ilike.%guest@example.com%",
    );
  });

  it("lets an attacker inject additional PostgREST filter syntax via `email`", async () => {
    // Payload: closes the intended `guest_email.ilike.%…%` value early with a
    // comma (PostgREST's OR-clause separator) and appends `status.ilike.%%`,
    // an always-true condition (any status matches a `%` wildcard on both
    // sides) — turning "find my one reservation" into "return every row".
    const injectedEmail = "a,status.ilike.%";

    await lookupReservation({ code: "ZZZZ", email: injectedEmail });

    const sentFilter = orSpy.mock.calls[0][0] as string;
    expect(sentFilter).toBe("code.ilike.%ZZZZ%,guest_email.ilike.%a,status.ilike.%%");

    // The resulting PostgREST filter has three top-level OR'd conditions —
    // the third one is unconditionally true, so it matches every reservation
    // regardless of the real `code`/`email` on file.
    const clauses = sentFilter.split(",");
    expect(clauses).toEqual([
      "code.ilike.%ZZZZ%",
      "guest_email.ilike.%a",
      "status.ilike.%%",
    ]);
  });
});
