/**
 * @file lookupAccount.server.test.ts — Regression test for AUTH-POC-3 (fixed in P3.1).
 *
 * Does NOT hit a real Supabase project. Mocks `@hotel/db` and asserts that the
 * service no longer builds PostgREST filter strings: the only filter is a
 * parameterized `.eq()` on a validated UUID, and the name is compared exactly in
 * code. The Fase 2 payload (`name = "a,is_active.eq.true"`) must return nothing.
 * See `docs/proyecto-seguridad/auth/fase-2-pocs.md` (AUTH-POC-3) for the original
 * reproduction and `fase-3-parches.md` for the fix.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";

const { builder, fromSpy, maybeSingleResult } = vi.hoisted(() => {
  const maybeSingleResult: { data: unknown; error: unknown } = { data: null, error: null };
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    or: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(maybeSingleResult)),
  };
  return { builder, fromSpy: vi.fn(() => builder), maybeSingleResult };
});

vi.mock("@hotel/db", async () => {
  const actual = await vi.importActual<typeof import("@hotel/db")>("@hotel/db");
  return {
    ...actual,
    createSupabaseServiceClient: vi.fn(() => ({ from: fromSpy })),
  };
});

import { lookupAccount } from "./lookupAccount.server";

describe("lookupAccount (AUTH-POC-3, fixed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingleResult.data = { id: ACCOUNT_ID, full_name: "Ada Lovelace", is_active: true };
    maybeSingleResult.error = null;
  });

  it("filters only with a parameterized .eq() on the account id (no .or() string)", async () => {
    const result = await lookupAccount({ name: "ada  lovelace ", accountId: ACCOUNT_ID });

    expect(builder.or).not.toHaveBeenCalled();
    expect(builder.ilike).not.toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith("id", ACCOUNT_ID);
    expect(result).toEqual([{ id: ACCOUNT_ID, fullName: "Ada Lovelace", isActive: true }]);
  });

  it("neutralizes the Fase 2 payload: injected filter syntax returns nothing", async () => {
    const result = await lookupAccount({ name: "a,is_active.eq.true", accountId: "none" });

    expect(result).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
    expect(builder.or).not.toHaveBeenCalled();
  });

  it("rejects a non-UUID accountId carrying filter syntax before querying", async () => {
    const result = await lookupAccount({
      name: "Ada Lovelace",
      accountId: `${ACCOUNT_ID},is_active.eq.true`,
    });

    expect(result).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("does not treat LIKE wildcards in the name as patterns", async () => {
    for (const name of ["%", "_%", "*", "Ada%"]) {
      expect(await lookupAccount({ name, accountId: ACCOUNT_ID })).toEqual([]);
    }
    expect(builder.ilike).not.toHaveBeenCalled();
  });

  it("returns nothing when the name does not match the account", async () => {
    expect(await lookupAccount({ name: "Mallory", accountId: ACCOUNT_ID })).toEqual([]);
  });
});
