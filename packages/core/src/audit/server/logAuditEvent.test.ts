import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInsert = vi.fn();

vi.mock("@hotel/db", () => ({
  DB_TABLES: { AUDIT_LOGS: "audit_logs" },
  createSupabaseServiceClient: () => ({ from: () => ({ insert: mockInsert }) }),
}));

import { logAuditEvent } from "./logAuditEvent";

describe("logAuditEvent", () => {
  beforeEach(() => {
    mockInsert.mockReset();
    mockInsert.mockResolvedValue({ error: null });
  });

  it("sanitizes email, entity, user-agent and metadata before inserting", async () => {
    await logAuditEvent({
      action: "auth.login.failure",
      actorEmail: "a@b.com\r\nforged line",
      entity: "x\ny",
      userAgent: "ua\r\nforged",
      ipAddress: "198.51.100.7",
      metadata: { email: "a@b.com\nforged" },
    });

    const row = mockInsert.mock.calls[0][0];
    expect(row.actor_email).toBe("a@b.com  forged line");
    expect(row.entity).toBe("x y");
    expect(row.user_agent).toBe("ua  forged");
    expect(row.metadata).toEqual({ email: "a@b.com forged" });
    expect(row.ip_address).toBe("198.51.100.7");
  });

  it("drops an ip_address that is not a valid IP", async () => {
    await logAuditEvent({ action: "a.b.c", ipAddress: "1.2.3.4\r\nforged" });

    expect(mockInsert.mock.calls[0][0].ip_address).toBeNull();
  });

  it("never throws when the insert fails", async () => {
    mockInsert.mockResolvedValue({ error: { message: "boom" } });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(logAuditEvent({ action: "a.b.c" })).resolves.toBeUndefined();
  });
});
