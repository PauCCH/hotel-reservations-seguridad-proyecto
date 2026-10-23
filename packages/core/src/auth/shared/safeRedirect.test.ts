import { describe, expect, it } from "vitest";
import { resolveSafeRedirectPath } from "./safeRedirect";

const FALLBACK = "/";

describe("resolveSafeRedirectPath (AUTH-POC-5)", () => {
  it("keeps same-origin paths with query and hash", () => {
    expect(resolveSafeRedirectPath("/reserve?room=1&n=2#pay", FALLBACK)).toBe(
      "/reserve?room=1&n=2#pay",
    );
    expect(resolveSafeRedirectPath("  /reservations/lookup ", FALLBACK)).toBe(
      "/reservations/lookup",
    );
  });

  it("rejects the Fase 2 payloads (absolute and protocol-relative URLs)", () => {
    for (const value of [
      "https://evil.example/phish",
      "https://example.com/",
      "//evil.example",
      "http://localhost:3001.evil.example/",
      "javascript:alert(1)",
    ]) {
      expect(resolveSafeRedirectPath(value, FALLBACK)).toBe(FALLBACK);
    }
  });

  it("rejects browser-normalisation tricks that turn into //host", () => {
    for (const value of [
      "/\\evil.example",
      "\\\\evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "/..//evil.example",
      "/.//evil.example",
    ]) {
      expect(resolveSafeRedirectPath(value, FALLBACK)).toBe(FALLBACK);
    }
  });

  it("keeps encoded slashes as an inert path (no host change)", () => {
    expect(resolveSafeRedirectPath("/%2F%2Fevil.example", FALLBACK)).toBe("/%2F%2Fevil.example");
  });

  it("falls back for empty, non-string and oversized values", () => {
    expect(resolveSafeRedirectPath("", FALLBACK)).toBe(FALLBACK);
    expect(resolveSafeRedirectPath(null, FALLBACK)).toBe(FALLBACK);
    expect(resolveSafeRedirectPath(undefined, FALLBACK)).toBe(FALLBACK);
    expect(resolveSafeRedirectPath(["/a"], FALLBACK)).toBe(FALLBACK);
    expect(resolveSafeRedirectPath(`/${"a".repeat(3000)}`, FALLBACK)).toBe(FALLBACK);
  });

  it("returns the provided fallback", () => {
    expect(resolveSafeRedirectPath("https://evil.example", "/home")).toBe("/home");
  });
});
