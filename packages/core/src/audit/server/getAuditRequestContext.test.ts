import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();

vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve({ get: mockGet })),
}));

import { getAuditRequestContext } from "./getAuditRequestContext";

describe("getAuditRequestContext", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("reads ip from x-forwarded-for and the user-agent header", async () => {
    mockGet.mockImplementation((name: string) => {
      if (name === "x-forwarded-for") return "203.0.113.5, 10.0.0.1";
      if (name === "user-agent") return "Mozilla/5.0";
      return null;
    });

    const result = await getAuditRequestContext();

    expect(result).toEqual({ ipAddress: "203.0.113.5", userAgent: "Mozilla/5.0" });
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", async () => {
    mockGet.mockImplementation((name: string) => {
      if (name === "x-real-ip") return "198.51.100.7";
      return null;
    });

    const result = await getAuditRequestContext();

    expect(result.ipAddress).toBe("198.51.100.7");
  });

  it("returns null ip and user-agent when no headers are present", async () => {
    mockGet.mockReturnValue(null);

    const result = await getAuditRequestContext();

    expect(result).toEqual({ ipAddress: null, userAgent: null });
  });
});
