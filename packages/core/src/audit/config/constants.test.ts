import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "./constants";

describe("AUDIT_ACTIONS", () => {
  const values = Object.values(AUDIT_ACTIONS);

  it("uses unique dot-namespaced lowercase values (namespace.entity.outcome)", () => {
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) expect(value).toMatch(/^[a-z]+(\.[a-z]+){1,2}$/);
  });

  it("keeps the original actions stable (they are already stored in audit_logs)", () => {
    expect(AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS).toBe("auth.login.success");
    expect(AUDIT_ACTIONS.AUTH_LOGIN_FAILED).toBe("auth.login.failed");
    expect(AUDIT_ACTIONS.AUDIT_LOG_VIEWED).toBe("audit.log.viewed");
  });

  it.each([
    ["AUTH_ACCESS_DENIED", "auth.access.denied"],
    ["USER_INVITED", "user.invited"],
    ["USER_ROLE_CHANGED", "user.role.changed"],
    ["USER_PERMISSION_GRANTED", "user.permission.granted"],
    ["USER_PERMISSION_REVOKED", "user.permission.revoked"],
    ["USER_STATUS_CHANGED", "user.status.changed"],
    ["RESERVATION_CREATED", "reservation.created"],
    ["RESERVATION_UPDATED", "reservation.updated"],
    ["RESERVATION_CANCELLED", "reservation.cancelled"],
    ["RESERVATION_DELETED", "reservation.deleted"],
  ])("offers %s for the Users/Operations/Auth modules", (key, value) => {
    expect(AUDIT_ACTIONS[key as keyof typeof AUDIT_ACTIONS]).toBe(value);
  });
});

describe("AUDIT_ENTITIES", () => {
  it("covers the entities the other modules audit", () => {
    expect(AUDIT_ENTITIES.RESERVATION).toBe("reservation");
    expect(AUDIT_ENTITIES.PERMISSION).toBe("permission");
    expect(AUDIT_ENTITIES.USER).toBe("user");
  });
});
