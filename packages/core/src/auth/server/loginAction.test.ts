import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSignInWithPassword,
  mockSignOut,
  mockLogAuditEvent,
  mockGetAuditRequestContext,
  mockVerifyAdminRole,
} = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockLogAuditEvent: vi.fn(),
  mockGetAuditRequestContext: vi.fn(),
  mockVerifyAdminRole: vi.fn(),
}));

const mockSupabase = {
  auth: {
    signInWithPassword: mockSignInWithPassword,
    signOut: mockSignOut,
  },
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [], set: () => {} })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`Redirect:${url}`);
  }),
}));

vi.mock("@hotel/db", () => ({
  createSupabaseServerClient: vi.fn(() => mockSupabase),
}));

vi.mock("../../audit", () => ({
  AUDIT_ACTIONS: { AUTH_LOGIN_SUCCESS: "auth.login.success", AUTH_LOGIN_FAILED: "auth.login.failed" },
  logAuditEvent: mockLogAuditEvent,
  getAuditRequestContext: mockGetAuditRequestContext,
}));

vi.mock("../index", () => ({
  verifyAdminRole: mockVerifyAdminRole,
}));

import { loginAction } from "./loginAction";

describe("loginAction audit logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuditRequestContext.mockResolvedValue({
      ipAddress: "203.0.113.5",
      userAgent: "Mozilla/5.0",
    });
  });

  it("attaches ip and user-agent to the failed-login audit event", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: { message: "bad creds" } });

    await loginAction("user@example.com", "wrong-password");

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: "203.0.113.5", userAgent: "Mozilla/5.0" }),
    );
  });

  it("attaches ip and user-agent to the successful-login audit event", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1", email: "user@example.com" }, session: {} },
      error: null,
    });

    await loginAction("user@example.com", "correct-password");

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: "203.0.113.5", userAgent: "Mozilla/5.0" }),
    );
  });

  it("still logs the audit event when ip and user-agent are unavailable", async () => {
    mockGetAuditRequestContext.mockResolvedValue({ ipAddress: null, userAgent: null });
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: { message: "bad creds" } });

    await loginAction("user@example.com", "wrong-password");

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: null, userAgent: null }),
    );
  });
});
