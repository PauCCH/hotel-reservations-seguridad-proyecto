import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginAction } from "@/features/auth/services/loginAction";

const {
  mockSignInWithPassword,
  mockSignOut,
  mockSingle,
  mockLogAuditEvent,
  mockGetAuditRequestContext,
} = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockSingle: vi.fn(),
  mockLogAuditEvent: vi.fn(),
  mockGetAuditRequestContext: vi.fn(),
}));

const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

const mockSupabase = {
  auth: {
    signInWithPassword: mockSignInWithPassword,
    signOut: mockSignOut,
  },
  from: mockFrom,
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      getAll: () => [],
      set: () => {},
      delete: () => {},
    }),
  ),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`Redirect:${url}`);
  }),
}));

vi.mock("@hotel/core/auth", async () => {
  const actual = await vi.importActual<typeof import("@hotel/core/auth")>("@hotel/core/auth");
  return {
    ...actual,
    verifyAdminRole: vi.fn(),
  };
});

vi.mock("@hotel/core/audit", async () => {
  const actual = await vi.importActual<typeof import("@hotel/core/audit")>("@hotel/core/audit");
  return {
    ...actual,
    logAuditEvent: mockLogAuditEvent,
    getAuditRequestContext: mockGetAuditRequestContext,
  };
});

vi.mock("@hotel/db", async () => {
  const actual = await vi.importActual<typeof import("@hotel/db")>("@hotel/db");
  return {
    ...actual,
    createSupabaseServerClient: vi.fn(() => mockSupabase),
  };
});

import { verifyAdminRole } from "@hotel/core/auth";

describe("loginAction owner role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuditRequestContext.mockResolvedValue({
      ipAddress: "203.0.113.5",
      userAgent: "Mozilla/5.0",
    });
  });

  it("returns INVALID_CREDENTIALS when signIn fails", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: { message: "bad creds" } });

    const result = await loginAction(null, new FormData());
    expect(result!.error).toBe("INVALID_CREDENTIALS");
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.login.failed",
        ipAddress: "203.0.113.5",
        userAgent: "Mozilla/5.0",
      }),
    );
  });

  it("redirects to dashboard for active owner", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { user: { id: "owner-1" } }, error: null });
    (verifyAdminRole as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "owner-1",
      role: "owner",
      is_active: true,
    });

    await expect(loginAction(null, new FormData())).rejects.toThrow("Redirect:/admin/dashboard");
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "owner-1",
        action: "auth.login.success",
        ipAddress: "203.0.113.5",
        userAgent: "Mozilla/5.0",
      }),
    );
  });

  it("returns ACCOUNT_DEACTIVATED for inactive owner", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: "owner-inactive" } },
      error: null,
    });
    (verifyAdminRole as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    mockSingle.mockResolvedValue({ data: { role: "owner" }, error: null });

    const result = await loginAction(null, new FormData());
    expect(result!.error).toBe("ACCOUNT_DEACTIVATED");
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "owner-inactive",
        action: "auth.login.failed",
        metadata: expect.objectContaining({ reason: "account_deactivated" }),
        ipAddress: "203.0.113.5",
        userAgent: "Mozilla/5.0",
      }),
    );
  });

  it("returns ACCESS_DENIED for client", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { user: { id: "client-1" } }, error: null });
    (verifyAdminRole as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    mockSingle.mockResolvedValue({ data: { role: "client" }, error: null });

    const result = await loginAction(null, new FormData());
    expect(result!.error).toBe("ACCESS_DENIED");
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "client-1",
        action: "auth.login.failed",
        metadata: expect.objectContaining({ reason: "access_denied" }),
        ipAddress: "203.0.113.5",
        userAgent: "Mozilla/5.0",
      }),
    );
  });

  it("redirects to dashboard for active admin", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null });
    (verifyAdminRole as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "admin-1",
      role: "admin",
      is_active: true,
    });

    await expect(loginAction(null, new FormData())).rejects.toThrow("Redirect:/admin/dashboard");
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        action: "auth.login.success",
        ipAddress: "203.0.113.5",
        userAgent: "Mozilla/5.0",
      }),
    );
  });

  it("still records the audit event when ip and user-agent cannot be determined", async () => {
    mockGetAuditRequestContext.mockResolvedValue({ ipAddress: null, userAgent: null });
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: { message: "bad creds" } });

    await loginAction(null, new FormData());

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: null, userAgent: null }),
    );
  });
});
