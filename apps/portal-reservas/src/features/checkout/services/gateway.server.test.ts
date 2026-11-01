/**
 * @file gateway.server.test.ts — Regression test for A3.4 (OP-POC-6).
 *
 * Before A3.4 the operations module wrote no audit events, so a booking left no
 * trace in `audit_logs`. This asserts that a persisted checkout records one
 * `reservation.created` event per booked row, with no actor (anonymous guest)
 * and without guest PII or free-text input in the metadata, and that rejected
 * checkouts record nothing. Supabase and the audit writer are mocked.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPersist, mockAvailable, mockLogAuditEvent } = vi.hoisted(() => ({
  mockPersist: vi.fn(),
  mockAvailable: vi.fn(),
  mockLogAuditEvent: vi.fn(() => Promise.resolve()),
}));

// The portal's vitest config has no "@/" alias, so these are mocked by id.
vi.mock("@/config/env", () => ({
  ENV: { APP_URL: "http://localhost:3001", STRIPE_SECRET_KEY: "" },
}));
vi.mock("@/config/routes", () => ({
  ROUTES: { RESERVE: "/reserve", RESERVE_SUCCESS: "/reserve/success" },
}));
vi.mock("@/features/rooms", () => ({
  findRoomsByIds: (ids: string[]) => ids.map((id) => ({ id, price: 100, capacity: 2 })),
}));

vi.mock("./createReservation.server", () => ({
  areRoomsAvailable: mockAvailable,
  persistReservation: mockPersist,
}));

vi.mock("@hotel/core/audit", () => ({
  AUDIT_ACTIONS: { RESERVATION_CREATED: "reservation.created" },
  AUDIT_ENTITIES: { RESERVATION: "reservation" },
}));
vi.mock("@hotel/core/audit/server", () => ({
  getAuditRequestContext: vi.fn(() => Promise.resolve({ ipAddress: null, userAgent: "ua" })),
  logAuditEvent: mockLogAuditEvent,
}));

import { ROOM_DB_ID } from "../constants/room-catalog";
import type { CheckoutSessionPayload } from "../domain/types";
import { openGatewaySession } from "./gateway.server";

/** YYYY-MM-DD `days` from today, so the schema's "future date" rule passes. */
function isoInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const payload = (): CheckoutSessionPayload =>
  ({
    roomIds: ["mv-1", "lf-2"],
    checkIn: isoInDays(10),
    checkOut: isoInDays(12),
    guests: 2,
    email: "guest@example.com",
    fullName: "Guest Name",
    phone: "8888-8888",
    specialRequests: "<img src=x onerror=alert(1)>\r\naction=audit.log.purged",
  }) as CheckoutSessionPayload;

describe("openGatewaySession audit (A3.4)", () => {
  beforeEach(() => {
    mockLogAuditEvent.mockClear();
    mockAvailable.mockResolvedValue(true);
    mockPersist.mockResolvedValue({
      ok: true,
      reservations: [
        { id: "res-a", room_id: ROOM_DB_ID["mv-1"] },
        { id: "res-b", room_id: ROOM_DB_ID["lf-2"] },
      ],
    });
  });

  it("records one reservation.created event per booked row", async () => {
    const result = await openGatewaySession(payload());

    expect(result.status).toBe(200);
    expect(mockLogAuditEvent).toHaveBeenCalledTimes(2);
    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      actorId: null,
      actorEmail: null,
      action: "reservation.created",
      entity: "reservation",
      entityId: "res-a",
      metadata: {
        source: "portal-checkout",
        room_id: ROOM_DB_ID["mv-1"],
        check_in: payload().checkIn,
        check_out: payload().checkOut,
        nights: 2,
        guests: 2,
        total_amount: 200,
      },
      ipAddress: null,
      userAgent: "ua",
    });
  });

  it("keeps guest PII and free-text input out of the audit event", async () => {
    await openGatewaySession(payload());

    const logged = JSON.stringify(mockLogAuditEvent.mock.calls);
    for (const value of ["guest@example.com", "Guest Name", "8888-8888", "onerror", "purged"]) {
      expect(logged).not.toContain(value);
    }
  });

  it("records nothing when the booking is not persisted", async () => {
    mockPersist.mockResolvedValue({ ok: false, reason: "conflict" });

    const result = await openGatewaySession(payload());

    expect(result.status).toBe(409);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it("records nothing for an invalid payload", async () => {
    const result = await openGatewaySession({ ...payload(), checkIn: "2000-01-01" });

    expect(result.status).toBe(400);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });
});
