/**
 * @file resolveAuthError.test.ts — Regression test for AUTH-POC-4 (fixed in P3.2) and O-04.
 *
 * The Fase 2 sink (`buildErrorDescriptionHtml` → `dangerouslySetInnerHTML`) is gone.
 * `/auth/error` now only derives an allowlisted key from `error`; nothing from the
 * query string is rendered. See `docs/proyecto-seguridad/auth/fase-2-pocs.md`
 * (AUTH-POC-4) for the original reproduction.
 */

import { describe, expect, it } from "vitest";
import { AUTH_ERROR_KEYS, resolveAuthErrorKey } from "./resolveAuthError";

describe("resolveAuthErrorKey (AUTH-POC-4, fixed)", () => {
  it("maps known Supabase/app codes case-insensitively", () => {
    expect(resolveAuthErrorKey({ error: "email_not_confirmed" })).toBe("EMAIL_NOT_CONFIRMED");
    expect(resolveAuthErrorKey({ error: "  Invalid_Credentials " })).toBe("INVALID_CREDENTIALS");
  });

  it("falls back to UNKNOWN_ERROR when the param is missing, repeated or unknown", () => {
    expect(resolveAuthErrorKey(undefined)).toBe("UNKNOWN_ERROR");
    expect(resolveAuthErrorKey({})).toBe("UNKNOWN_ERROR");
    expect(resolveAuthErrorKey({ error: ["email_not_confirmed", "x"] })).toBe("UNKNOWN_ERROR");
    expect(resolveAuthErrorKey({ error: "access_denied" })).toBe("UNKNOWN_ERROR");
  });

  it("ignores the Fase 2 payload in error_description entirely", () => {
    const payload = "<img src=x onerror=alert(document.cookie)>";

    expect(resolveAuthErrorKey({ error_description: payload })).toBe("UNKNOWN_ERROR");
    expect(resolveAuthErrorKey({ error: "email_not_confirmed", error_description: payload })).toBe(
      "EMAIL_NOT_CONFIRMED",
    );
  });

  it("never echoes markup or arbitrary text placed in `error`", () => {
    for (const error of ["<script>alert(1)</script>", "Your account was locked, call +506 0000"]) {
      const key = resolveAuthErrorKey({ error });
      expect(key).toBe("UNKNOWN_ERROR");
      expect(AUTH_ERROR_KEYS).toContain(key);
    }
  });
});
