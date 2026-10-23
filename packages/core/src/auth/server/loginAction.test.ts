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
  AUDIT_ACTIONS: {
    AUTH_LOGIN_SUCCESS: "auth.login.success",
    AUTH_LOGIN_FAILED: "auth.login.failed",
  },
}));

vi.mock("../../audit/server", () => ({
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

  it("does not attribute a failed login to the typed email (AUTH-POC-6)", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {},
      error: { code: "invalid_credentials", message: "provider text\nforged line" },
    });

    await loginAction("victima@hotel.com\n[SYSTEM] LOGIN_SUCCESS actor=owner@hotel.com", "x");

    const event = mockLogAuditEvent.mock.calls[0][0];
    expect(event.actorEmail).toBeNull();
    expect(event.actorId).toBeUndefined();
    expect(event.metadata).toEqual({
      reason: "invalid_credentials",
      attempted_email: null,
      attempted_email_valid: false,
    });
    expect(JSON.stringify(event)).not.toContain("SYSTEM");
    expect(JSON.stringify(event)).not.toContain("provider text");
  });

  it("keeps a well-formed typed email only as metadata, not as the actor", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: { code: "invalid_credentials" } });

    await loginAction("Owner@Hotel.Local", "wrong-password");

    const event = mockLogAuditEvent.mock.calls[0][0];
    expect(event.actorEmail).toBeNull();
    expect(event.metadata).toMatchObject({ attempted_email: "owner@hotel.local" });
  });

  it("uses the authenticated user's email as actor and never logs the session token", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "user@example.com" },
        session: { access_token: "secret-access-token" },
      },
      error: null,
    });

    await loginAction("USER@example.com", "correct-password");

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "user-1", actorEmail: "user@example.com" }),
    );
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain("secret-access-token");
    logSpy.mockRestore();
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
