import { describe, expect, it } from "vitest";
import {
  buildFailedLoginMetadata,
  LOGIN_FAILURE_REASONS,
  loginFailureReasonFromAuthError,
  normalizeLoginEmail,
} from "./loginAudit";

describe("normalizeLoginEmail (AUTH-POC-6)", () => {
  it("lower-cases and trims well-formed addresses", () => {
    expect(normalizeLoginEmail("  Ada.Lovelace+test@Hotel.Local ")).toBe(
      "ada.lovelace+test@hotel.local",
    );
  });

  it("rejects the Fase 2 payloads (CR/LF line forging and free text)", () => {
    for (const value of [
      "victima@hotel.com\n[SYSTEM] LOGIN_SUCCESS actor=owner@hotel.com",
      "victima@hotel.com\r\nforged",
      "owner@hotel.local [SYSTEM] login.success",
      "<script>alert(1)</script>@x.io",
      'a"b@hotel.local',
      "no-at-sign",
      "",
    ]) {
      expect(normalizeLoginEmail(value)).toBeNull();
    }
  });

  it("rejects non-strings and oversized values", () => {
    expect(normalizeLoginEmail(null)).toBeNull();
    expect(normalizeLoginEmail(42)).toBeNull();
    expect(normalizeLoginEmail(`${"a".repeat(250)}@x.io`)).toBeNull();
  });
});

describe("loginFailureReasonFromAuthError", () => {
  it("maps known Supabase codes to closed reasons", () => {
    expect(loginFailureReasonFromAuthError({ code: "invalid_credentials" })).toBe(
      LOGIN_FAILURE_REASONS.INVALID_CREDENTIALS,
    );
    expect(loginFailureReasonFromAuthError({ code: "email_not_confirmed" })).toBe(
      LOGIN_FAILURE_REASONS.EMAIL_NOT_CONFIRMED,
    );
    expect(loginFailureReasonFromAuthError({ code: "over_request_rate_limit" })).toBe(
      LOGIN_FAILURE_REASONS.RATE_LIMITED,
    );
    expect(loginFailureReasonFromAuthError({ status: 429 })).toBe(
      LOGIN_FAILURE_REASONS.RATE_LIMITED,
    );
  });

  it("never passes through unknown codes or messages", () => {
    expect(loginFailureReasonFromAuthError({ code: "attacker\ncontrolled" })).toBe(
      LOGIN_FAILURE_REASONS.UNKNOWN,
    );
    expect(loginFailureReasonFromAuthError(null)).toBe(LOGIN_FAILURE_REASONS.UNKNOWN);
  });
});

describe("buildFailedLoginMetadata", () => {
  it("records a valid typed email only as attempted_email", () => {
    expect(
      buildFailedLoginMetadata("Owner@Hotel.Local", LOGIN_FAILURE_REASONS.INVALID_CREDENTIALS),
    ).toEqual({
      reason: "invalid_credentials",
      attempted_email: "owner@hotel.local",
      attempted_email_valid: true,
    });
  });

  it("drops a forged email entirely", () => {
    const metadata = buildFailedLoginMetadata(
      "victima@hotel.com\n[SYSTEM] LOGIN_SUCCESS actor=owner@hotel.com",
      LOGIN_FAILURE_REASONS.INVALID_CREDENTIALS,
    );

    expect(metadata).toEqual({
      reason: "invalid_credentials",
      attempted_email: null,
      attempted_email_valid: false,
    });
    expect(JSON.stringify(metadata)).not.toContain("SYSTEM");
  });
});
