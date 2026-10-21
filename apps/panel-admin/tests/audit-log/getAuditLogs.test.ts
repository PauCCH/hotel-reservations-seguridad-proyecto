import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuditLogs } from "@/features/audit-log/services/getAuditLogs";
import { PermissionDeniedError } from "@/shared/auth/errors";

const { mockGetSession, mockVerifyAdminRole, mockRequirePermission, calls } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockVerifyAdminRole: vi.fn(),
  mockRequirePermission: vi.fn(),
  calls: [] as { method: string; args: unknown[] }[],
}));

vi.mock("next/headers", () => ({ cookies: vi.fn(() => Promise.resolve({})) }));

vi.mock("@hotel/core/auth", () => ({ verifyAdminRole: mockVerifyAdminRole }));

vi.mock("@hotel/core/audit", () => ({
  AUDIT_ACTIONS: {
    AUTH_LOGIN_SUCCESS: "auth.login.success",
    AUTH_LOGIN_FAILED: "auth.login.failed",
    AUDIT_LOG_VIEWED: "audit.log.viewed",
  },
  AUDIT_ENTITIES: { AUDIT_LOGS: "audit_logs" },
  getAuditRequestContext: vi.fn(() => Promise.resolve({ ipAddress: null, userAgent: null })),
  logAuditEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/shared/auth/requirePermission", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@hotel/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@hotel/db")>();
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lte", "or", "ilike", "order"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.range = (...args: unknown[]) => {
    calls.push({ method: "range", args });
    return Promise.resolve({ data: [], error: null, count: 0 });
  };
  return {
    ...actual,
    createSupabaseServerClient: () => ({ auth: { getSession: mockGetSession } }),
    createSupabaseServiceClient: () => ({ from: () => builder }),
  };
});

const callsOf = (method: string) => calls.filter((c) => c.method === method);

describe("getAuditLogs", () => {
  beforeEach(() => {
    calls.length = 0;
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "u1", email: "a@b.c" } } },
    });
    mockVerifyAdminRole.mockResolvedValue({ role: "admin" });
    mockRequirePermission.mockResolvedValue(undefined);
  });

  it("rejects an admin without audit:view (AUD-POC-1)", async () => {
    mockRequirePermission.mockRejectedValue(new PermissionDeniedError("audit:view"));

    await expect(getAuditLogs()).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(calls).toHaveLength(0);
  });

  it("does not let the search payload add filter conditions (AUD-POC-2)", async () => {
    await getAuditLogs({ search: 'x%,actor_email.neq."".' });

    const orArgs = callsOf("or").map((c) => String(c.args[0]));
    for (const arg of orArgs) {
      // exactly two conditions: one comma, no quotes or injected operators
      expect(arg.split(",")).toHaveLength(2);
      expect(arg).not.toContain('"');
      const [actionCondition, emailCondition] = arg.split(",");
      expect(actionCondition).toMatch(/^action\.ilike\.%[^%]*%$/);
      expect(emailCondition).toMatch(/^actor_email\.ilike\.%[^%]*%$/);
      expect(arg).not.toMatch(/[()"\\]/);
    }
  });

  it("ignores an action outside the allowlist", async () => {
    await getAuditLogs({ action: "x,id.neq.0" });

    expect(callsOf("eq")).toHaveLength(0);
  });

  it("applies a valid action filter", async () => {
    await getAuditLogs({ action: "auth.login.failed" });

    expect(callsOf("eq")[0]?.args).toEqual(["action", "auth.login.failed"]);
  });

  it("rejects unparseable dates", async () => {
    await expect(getAuditLogs({ from: "not-a-date" })).rejects.toThrow();
  });

  it("clamps pageSize to 100 (AUD-POC-3)", async () => {
    const result = await getAuditLogs({ pageSize: 1_000_000 });

    expect(result.pageSize).toBe(100);
    expect(callsOf("range")[0]?.args).toEqual([0, 99]);
  });

  it.each([0, -3, 1.5, Number.NaN])("normalizes invalid page %s to 1", async (page) => {
    const result = await getAuditLogs({ page });

    expect(result.page).toBe(1);
    expect(callsOf("range")[0]?.args[0]).toBe(0);
  });

  it.each([0, -5, Number.NaN])("falls back to default for pageSize %s", async (pageSize) => {
    const result = await getAuditLogs({ pageSize });

    expect(result.pageSize).toBe(25);
  });
});
