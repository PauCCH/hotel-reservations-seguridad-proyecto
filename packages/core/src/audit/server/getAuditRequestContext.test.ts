import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();

vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve({ get: mockGet })),
}));

import { getAuditRequestContext } from "./getAuditRequestContext";

const withHeaders = (values: Record<string, string>) =>
  mockGet.mockImplementation((name: string) => values[name] ?? null);

describe("getAuditRequestContext", () => {
  beforeEach(() => {
    mockGet.mockReset();
    vi.stubEnv("AUDIT_TRUSTED_PROXY_HOPS", "1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the IP the trusted proxy appended (rightmost), not the client-forged left entry", async () => {
    withHeaders({
      "x-forwarded-for": "203.0.113.99, 198.51.100.7",
      "user-agent": "Mozilla/5.0",
    });

    expect(await getAuditRequestContext()).toEqual({
      ipAddress: "198.51.100.7",
      userAgent: "Mozilla/5.0",
    });
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", async () => {
    withHeaders({ "x-real-ip": "198.51.100.7" });

    expect((await getAuditRequestContext()).ipAddress).toBe("198.51.100.7");
  });

  it("ignores forwarding headers when no proxy is trusted (default)", async () => {
    vi.stubEnv("AUDIT_TRUSTED_PROXY_HOPS", "");
    withHeaders({ "x-forwarded-for": "203.0.113.99", "x-real-ip": "203.0.113.98" });

    expect((await getAuditRequestContext()).ipAddress).toBeNull();
  });

  it("drops a malformed forwarded value instead of storing it", async () => {
    withHeaders({ "x-forwarded-for": "<img src=x onerror=alert(1)>" });

    expect((await getAuditRequestContext()).ipAddress).toBeNull();
  });

  it("strips line breaks and control characters from the user-agent", async () => {
    withHeaders({ "user-agent": "curl/8\r\n2026-01-01 action=audit.log.purged" });

    expect((await getAuditRequestContext()).userAgent).toBe(
      "curl/8  2026-01-01 action=audit.log.purged",
    );
  });

  it("returns null ip and user-agent when no headers are present", async () => {
    mockGet.mockReturnValue(null);

    expect(await getAuditRequestContext()).toEqual({ ipAddress: null, userAgent: null });
  });
});
