/**
 * @file lookupReservation.server.test.ts — Regression test for A3.1 (OP-POC-1).
 *
 * Does NOT hit a real Supabase project. Mocks `@hotel/db` and asserts that the
 * lookup now binds `code`/`email` through parameterized `.eq()` calls and never
 * builds a `.or()` filter string. This is the Fase 3 regression signal: the
 * OP-POC-1 injection (`email = "a,status.ilike.%"`) can no longer inject filter
 * syntax — PostgREST receives it as a literal equality value — so the
 * always-true OR clause that dumped every row is gone.
 *
 * See `lookupReservation.server.ts` for the fix writeup and
 * `docs/proyecto-seguridad/operations/fase-2-pocs.md` (OP-POC-1) for the
 * original vulnerable reproduction.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const eqSpy = vi.fn();
const orSpy = vi.fn();

vi.mock("@hotel/db", async () => {
  const actual = await vi.importActual<typeof import("@hotel/db")>("@hotel/db");

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      eqSpy(column, value);
      return builder;
    }),
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

describe("lookupReservation (A3.1 fix for OP-POC-1)", () => {
  beforeEach(() => {
    eqSpy.mockClear();
    orSpy.mockClear();
  });

  it("binds code and email as parameterized .eq() filters (never .or())", async () => {
    await lookupReservation({ code: "RES-001", email: "guest@example.com" });

    expect(orSpy).not.toHaveBeenCalled();
    expect(eqSpy).toHaveBeenCalledWith("code", "RES-001");
    expect(eqSpy).toHaveBeenCalledWith("guest_email", "guest@example.com");
  });

  it("neutralizes the OP-POC-1 payload: injected syntax is passed as a literal value", async () => {
    // The original attack closed the email filter with a comma (PostgREST's
    // OR separator) and appended an always-true `status.ilike.%%` clause.
    const injectedEmail = "a,status.ilike.%";

    await lookupReservation({ code: "ZZZZ", email: injectedEmail });

    // No OR filter is built at all, and the payload reaches .eq() verbatim as a
    // value — PostgREST compares `guest_email = "a,status.ilike.%"` literally,
    // which matches no row, instead of being parsed as extra filter clauses.
    expect(orSpy).not.toHaveBeenCalled();
    expect(eqSpy).toHaveBeenCalledWith("guest_email", injectedEmail);
  });
});
