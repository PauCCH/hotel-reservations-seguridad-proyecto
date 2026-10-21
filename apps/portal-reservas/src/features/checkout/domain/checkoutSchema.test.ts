/**
 * @file checkoutSchema.test.ts — Regression test for A3.3 (OP-POC-5).
 *
 * Proves the server-side checkout validation rejects the parameter-manipulation
 * payloads from OP-POC-5 (past dates, inverted ranges, non-positive guests) and
 * accepts a well-formed booking. Pure schema test, no DB.
 */

import { describe, expect, it } from "vitest";
import { checkoutPayloadSchema } from "./checkoutSchema";

const future = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const base = {
  roomIds: ["room-std-01"],
  checkIn: future(10),
  checkOut: future(12),
  guests: 2,
  email: "guest@example.com",
  fullName: "Ada Lovelace",
  phone: "+506 8888-8888",
  specialRequests: "",
};

describe("checkoutPayloadSchema (A3.3 fix for OP-POC-5)", () => {
  it("accepts a well-formed future booking", () => {
    expect(checkoutPayloadSchema.safeParse(base).success).toBe(true);
  });

  it("rejects check-in in the past", () => {
    const result = checkoutPayloadSchema.safeParse({
      ...base,
      checkIn: "2020-01-01",
      checkOut: "2020-01-05",
    });
    expect(result.success).toBe(false);
  });

  it("rejects check-out not after check-in", () => {
    const result = checkoutPayloadSchema.safeParse({
      ...base,
      checkIn: future(12),
      checkOut: future(10),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive guest count", () => {
    expect(checkoutPayloadSchema.safeParse({ ...base, guests: 0 }).success).toBe(false);
  });

  it("rejects an empty room list", () => {
    expect(checkoutPayloadSchema.safeParse({ ...base, roomIds: [] }).success).toBe(false);
  });
});
