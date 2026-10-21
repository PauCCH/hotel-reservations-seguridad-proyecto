import { describe, expect, it } from "vitest";
import {
  AUDIT_MAX_TEXT_LENGTH,
  resolveClientIp,
  sanitizeAuditMetadata,
  sanitizeAuditText,
} from "./sanitize";

describe("sanitizeAuditText", () => {
  it("returns null for nullish input", () => {
    expect(sanitizeAuditText(null)).toBeNull();
    expect(sanitizeAuditText(undefined)).toBeNull();
  });

  it("replaces CR/LF and other control characters so a value stays on one line", () => {
    const forged = "a@b.com\r\n2026-01-01 action=audit.log.purged actor=owner@hotel.local";
    expect(sanitizeAuditText(forged)).toBe(
      "a@b.com  2026-01-01 action=audit.log.purged actor=owner@hotel.local",
    );
    expect(sanitizeAuditText("x\u0000y\u001by\u007fz w")).toBe("x y y z w");
  });

  it("truncates to the max length", () => {
    expect(sanitizeAuditText("x".repeat(AUDIT_MAX_TEXT_LENGTH + 50))).toHaveLength(
      AUDIT_MAX_TEXT_LENGTH,
    );
  });
});

describe("sanitizeAuditMetadata", () => {
  it("sanitizes string values and keys, recursively", () => {
    expect(
      sanitizeAuditMetadata({ "k\n1": "v\r\nx", nested: { a: ["l1\nl2", 3, true, null] } }),
    ).toEqual({
      "k 1": "v  x",
      nested: { a: ["l1 l2", 3, true, null] },
    });
  });

  it("caps depth so deeply nested payloads can't blow up storage", () => {
    const deep = { a: { b: { c: { d: { e: { f: "x" } } } } } };
    expect(JSON.stringify(sanitizeAuditMetadata(deep))).not.toContain('"f"');
  });

  it("returns an empty object for non-object input", () => {
    expect(sanitizeAuditMetadata(undefined)).toEqual({});
  });
});

describe("resolveClientIp", () => {
  it("ignores forwarding headers when no proxy hops are trusted", () => {
    expect(resolveClientIp("203.0.113.9", "198.51.100.7", 0)).toBeNull();
  });

  it("takes the entry added by the Nth trusted proxy from the right, not the spoofable left", () => {
    // client forged "203.0.113.99"; the single trusted proxy appended the real peer.
    expect(resolveClientIp("203.0.113.99, 198.51.100.7", null, 1)).toBe("198.51.100.7");
    expect(resolveClientIp("203.0.113.99, 198.51.100.7, 10.0.0.1", null, 2)).toBe("198.51.100.7");
  });

  it("returns null when the chain is shorter than the trusted hops", () => {
    expect(resolveClientIp("198.51.100.7", null, 2)).toBeNull();
  });

  it("rejects values that are not valid IPs", () => {
    expect(resolveClientIp("<script>alert(1)</script>", null, 1)).toBeNull();
    expect(resolveClientIp("1.2.3.4\r\nforged", null, 1)).toBeNull();
  });

  it("uses x-real-ip only when a proxy is trusted and no XFF is present", () => {
    expect(resolveClientIp(null, "198.51.100.7", 1)).toBe("198.51.100.7");
    expect(resolveClientIp(null, "not-an-ip", 1)).toBeNull();
  });

  it("accepts IPv6", () => {
    expect(resolveClientIp("2001:db8::1", null, 1)).toBe("2001:db8::1");
  });
});
