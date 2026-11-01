/**
 * Regression test for A3.4 (OP-POC-6): a reservation status change made from
 * the panel is recorded in the audit trail with the verified admin as actor.
 * Mocks Supabase and the audit writer; does not hit a real project.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateReservationStatus } from "@/features/reservations/services/reservationService";
import { PermissionDeniedError } from "@/shared/auth/errors";

const { mockRequirePermission, mockLogAuditEvent, mockGetUser, state } = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockLogAuditEvent: vi.fn(() => Promise.resolve()),
  mockGetUser: vi.fn(),
  state: {
    previous: null as { status: string } | null,
    updateError: null as { message: string } | null,
  },
}));

vi.mock("next/headers", () => ({ cookies: vi.fn(() => Promise.resolve({})) }));

vi.mock("@hotel/core/audit", () => ({
  AUDIT_ACTIONS: {
    RESERVATION_UPDATED: "reservation.updated",
    RESERVATION_CANCELLED: "reservation.cancelled",
  },
  AUDIT_ENTITIES: { RESERVATION: "reservation" },
}));

vi.mock("@hotel/core/audit/server", () => ({
  getAuditRequestContext: vi.fn(() => Promise.resolve({ ipAddress: null, userAgent: "ua" })),
  logAuditEvent: mockLogAuditEvent,
}));

vi.mock("@hotel/core/auth", () => ({
  getVerifiedSession: async () => ({ session: null, user: await mockGetUser() }),
}));

vi.mock("@/shared/auth/requirePermission", () => ({ requirePermission: mockRequirePermission }));

vi.mock("@hotel/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@hotel/db")>();
  return { ...actual, createSupabaseServerClient: () => ({}) };
});

vi.mock("@hotel/db/client", () => {
  const select = {
    eq: () => select,
    maybeSingle: () => Promise.resolve({ data: state.previous, error: null }),
  };
  return {
    createSupabaseServiceClient: () => ({
      from: () => ({
        select: () => select,
        update: () => ({ eq: () => Promise.resolve({ error: state.updateError }) }),
      }),
    }),
  };
});

describe("updateReservationStatus audit (A3.4)", () => {
  beforeEach(() => {
    mockRequirePermission.mockReset().mockResolvedValue(undefined);
    mockLogAuditEvent.mockClear();
    mockGetUser.mockResolvedValue({ id: "admin-1", email: "admin@hotel.local" });
    state.previous = { status: "pending" };
    state.updateError = null;
  });

  it("records an approval as reservation.updated with from/to and the real actor", async () => {
    await updateReservationStatus("res-1", "approved");

    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      actorId: "admin-1",
      actorEmail: "admin@hotel.local",
      action: "reservation.updated",
      entity: "reservation",
      entityId: "res-1",
      metadata: { from: "pending", to: "approved" },
      ipAddress: null,
      userAgent: "ua",
    });
  });

  it("records a cancellation as reservation.cancelled with its reason", async () => {
    await updateReservationStatus("res-1", "cancelled", "guest request");

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "reservation.cancelled",
        metadata: { from: "pending", to: "cancelled", cancellation_reason: "guest request" },
      }),
    );
  });

  it("does not log when the caller lacks reservations:edit", async () => {
    mockRequirePermission.mockRejectedValue(new PermissionDeniedError("reservations:edit"));

    await expect(updateReservationStatus("res-1", "approved")).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it("does not log when the update fails", async () => {
    state.updateError = { message: "boom" };

    await expect(updateReservationStatus("res-1", "approved")).rejects.toThrow();
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it("does not log for an unknown reservation id", async () => {
    state.previous = null;

    await updateReservationStatus("missing", "approved");
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });
});
