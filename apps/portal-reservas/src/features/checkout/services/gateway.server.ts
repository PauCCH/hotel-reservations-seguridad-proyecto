/**
 * @file gateway.server.ts — Server-side creation of a payment-gateway session.
 *
 * Resolves the reservation from its room IDs, then opens a Stripe Checkout
 * Session via the REST API (no SDK) and returns the hosted URL to redirect to.
 * Card data is collected by Stripe's hosted page, never by this app. When no
 * STRIPE_SECRET_KEY is configured, a mock session URL stands in so the flow
 * stays demoable without credentials.
 */

import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "@hotel/core/audit";
import { getAuditRequestContext, logAuditEvent } from "@hotel/core/audit/server";
import { ENV } from "@/config/env";
import { ROUTES } from "@/config/routes";
import { findRoomsByIds } from "@/features/rooms";
import {
  CHECKOUT_API_ERROR,
  CHECKOUT_HTTP,
  CHECKOUT_HTTP_STATUS,
  MOCK_SESSION_PREFIX,
  RESERVATION_AUDIT_SOURCE,
  SESSION_ID_PARAM,
  STRIPE,
  STRIPE_SESSION_PLACEHOLDER,
} from "../constants/checkout.constants";
import { toRoomDbIds } from "../constants/room-catalog";
import { checkoutPayloadSchema } from "../domain/checkoutSchema";
import { computeNights } from "../domain/reservation";
import { buildStripeCheckoutParams } from "../domain/stripe";
import type { CheckoutSessionPayload } from "../domain/types";
import { areRoomsAvailable, persistReservation } from "./createReservation.server";

export interface GatewayResult {
  status: number;
  body: { url: string } | { error: string };
}

export async function openGatewaySession(payload: CheckoutSessionPayload): Promise<GatewayResult> {
  // A3.3 / OP-POC-5: strict server-side validation of the client payload
  // (shape, future dates, positive guest count) before anything is trusted.
  const parsed = checkoutPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      status: CHECKOUT_HTTP_STATUS.BAD_REQUEST,
      body: { error: CHECKOUT_API_ERROR.INVALID_REQUEST },
    };
  }
  const input = parsed.data;

  const rooms = findRoomsByIds(input.roomIds);
  // Catalog ids ("mv-1") → public.rooms uuids; the DB only understands the latter.
  const roomDbIds = toRoomDbIds(input.roomIds);
  if (rooms.length !== input.roomIds.length || !roomDbIds) {
    return {
      status: CHECKOUT_HTTP_STATUS.BAD_REQUEST,
      body: { error: CHECKOUT_API_ERROR.INVALID_REQUEST },
    };
  }

  // Capacity: guests cannot exceed the combined capacity of the booked rooms.
  const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
  if (input.guests > totalCapacity) {
    return {
      status: CHECKOUT_HTTP_STATUS.BAD_REQUEST,
      body: { error: CHECKOUT_API_ERROR.INVALID_REQUEST },
    };
  }

  // Availability: reject overlapping bookings for any of the rooms.
  if (!(await areRoomsAvailable(roomDbIds, input.checkIn, input.checkOut))) {
    return {
      status: CHECKOUT_HTTP_STATUS.CONFLICT,
      body: { error: CHECKOUT_API_ERROR.UNAVAILABLE },
    };
  }

  const nights = computeNights(input.checkIn, input.checkOut);

  // Persist the booking so it appears in the admin panel (realistic flow that
  // the demo was missing). The DB-level EXCLUDE constraint is authoritative for
  // availability (closes the TOCTOU race): a concurrent overlapping insert
  // fails here even if it passed areRoomsAvailable above.
  const persisted = await persistReservation(input, rooms, roomDbIds, nights);
  if (!persisted.ok) {
    return persisted.reason === "conflict"
      ? { status: CHECKOUT_HTTP_STATUS.CONFLICT, body: { error: CHECKOUT_API_ERROR.UNAVAILABLE } }
      : { status: CHECKOUT_HTTP_STATUS.BAD_GATEWAY, body: { error: CHECKOUT_API_ERROR.GATEWAY } };
  }

  // A3.4 / OP-POC-6: one audit event per booked row. The checkout is anonymous,
  // so there is no actor; metadata holds only validated, server-computed values
  // (no guest name, email, phone, notes or lookup code — PII / attacker input).
  const { ipAddress, userAgent } = await getAuditRequestContext();
  for (const reservation of persisted.reservations) {
    const room = rooms[roomDbIds.indexOf(reservation.room_id)];
    await logAuditEvent({
      actorId: null,
      actorEmail: null,
      action: AUDIT_ACTIONS.RESERVATION_CREATED,
      entity: AUDIT_ENTITIES.RESERVATION,
      entityId: reservation.id,
      metadata: {
        source: RESERVATION_AUDIT_SOURCE,
        room_id: reservation.room_id,
        check_in: input.checkIn,
        check_out: input.checkOut,
        nights,
        guests: input.guests,
        total_amount: room ? room.price * nights : null,
      },
      ipAddress,
      userAgent,
    });
  }

  const successUrl = `${ENV.APP_URL}${ROUTES.RESERVE_SUCCESS}?${SESSION_ID_PARAM}=${STRIPE_SESSION_PLACEHOLDER}`;
  const cancelUrl = `${ENV.APP_URL}${ROUTES.RESERVE}`;

  // No key configured → mock gateway: jump straight to the success screen.
  if (!ENV.STRIPE_SECRET_KEY) {
    const mockUrl = `${ENV.APP_URL}${ROUTES.RESERVE_SUCCESS}?${SESSION_ID_PARAM}=${MOCK_SESSION_PREFIX}${Date.now()}`;
    return { status: CHECKOUT_HTTP_STATUS.OK, body: { url: mockUrl } };
  }

  const params = buildStripeCheckoutParams({
    rooms,
    nights,
    email: input.email,
    successUrl,
    cancelUrl,
  });

  const response = await fetch(STRIPE.SESSIONS_URL, {
    method: CHECKOUT_HTTP.METHOD_POST,
    headers: {
      Authorization: `${STRIPE.AUTH_SCHEME} ${ENV.STRIPE_SECRET_KEY}`,
      [CHECKOUT_HTTP.CONTENT_TYPE_HEADER]: STRIPE.CONTENT_TYPE,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    return {
      status: CHECKOUT_HTTP_STATUS.BAD_GATEWAY,
      body: { error: CHECKOUT_API_ERROR.GATEWAY },
    };
  }

  const session = (await response.json()) as { url: string };
  return { status: CHECKOUT_HTTP_STATUS.OK, body: { url: session.url } };
}
