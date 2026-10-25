/**
 * @file createReservation.server.ts — Persists a reservation row at checkout.
 *
 * Previously the checkout flow only opened a payment session and never wrote a
 * reservation (the table was seeded manually, see finding O10 in
 * `docs/proyecto-seguridad/operations/fase-1-diagnostico.md`). This persists the
 * booking so it shows up in the admin panel, which is the realistic flow.
 *
 * ⚠️ SECURITY COURSE PROJECT — part of OP-POC-3 (stored XSS, guest → panel) ⚠️
 * The guest-supplied `specialRequests` is stored verbatim as `guest_notes`.
 * Storing raw user input is normal; the vulnerability is that the admin panel
 * renders it UNESCAPED (`ReservationGuestCard.tsx`), so a payload typed here by
 * an anonymous guest executes in the authenticated admin's session. Introduced
 * per the team decision in `docs/proyecto-seguridad/plan-desarrollo.md` §4.1
 * because this module had no real stored-XSS sink. The Fase 3 fix (A3.2)
 * escapes the value on output; this file stays as-is.
 *
 * `reservations` has RLS enabled with NO policies (deny-all), so a public
 * checkout has nothing to insert as except the service-role client — the same
 * pattern already used by `reservationService.ts` and `galleryActions.ts`.
 *
 * Intentionally NOT a "use server" module (A3.4 hardening): that would expose
 * `persistReservation` / `areRoomsAvailable` as public Server Actions callable
 * without the route's Origin check and Zod validation. Only
 * `gateway.server.ts` (called from `POST /api/checkout`) imports it.
 */

import type { Room } from "@/features/rooms";
import { createSupabaseServiceClient, DB_COLUMNS, DB_TABLES } from "@hotel/db";
import { RESERVATION_STATUS_CANCELLED } from "../constants/checkout.constants";
import type { CheckoutSessionPayload } from "../domain/types";

/**
 * A3.3 / OP-POC-5: returns true when every room is free for the requested
 * range. A non-cancelled reservation overlaps when its check_in is before the
 * new check_out AND its check_out is after the new check_in. Runs as the
 * service-role client (reservations is deny-all under RLS).
 */
export async function areRoomsAvailable(
  roomIds: string[],
  checkIn: string,
  checkOut: string,
): Promise<boolean> {
  const supabase = createSupabaseServiceClient();
  const c = DB_COLUMNS.reservations;

  const { data, error } = await supabase
    .from(DB_TABLES.RESERVATIONS)
    .select(c.id)
    .in(c.room_id, roomIds)
    .neq(c.status, RESERVATION_STATUS_CANCELLED)
    .lt(c.check_in, checkOut)
    .gt(c.check_out, checkIn)
    .limit(1);

  if (error) return false; // fail closed: treat an error as "not available"
  return (data?.length ?? 0) === 0;
}

/** Postgres SQLSTATE for an exclusion-constraint violation (reservations_no_overlap). */
const PG_EXCLUSION_VIOLATION = "23P01";

/** One inserted reservation row, returned so the caller can audit it (A3.4). */
export interface PersistedReservationRow {
  id: string;
  room_id: string;
}

export type PersistReservationResult =
  | { ok: true; reservations: PersistedReservationRow[] }
  | { ok: false; reason: "conflict" | "error" };

/**
 * Inserts one reservation row per booked room in a single statement, so the
 * EXCLUDE constraint guards every room (not only the first) and a conflict on
 * any of them rolls back the whole booking. `roomDbIds` are the public.rooms
 * uuids matching `rooms` by index (see `constants/room-catalog.ts`).
 */
export async function persistReservation(
  payload: CheckoutSessionPayload,
  rooms: Room[],
  roomDbIds: string[],
  nights: number,
): Promise<PersistReservationResult> {
  const supabase = createSupabaseServiceClient();
  const c = DB_COLUMNS.reservations;

  const { data, error } = await supabase
    .from(DB_TABLES.RESERVATIONS)
    .insert(
      rooms.map((room, i) => ({
        [c.guest_name]: payload.fullName,
        [c.guest_email]: payload.email,
        [c.guest_phone]: payload.phone,
        [c.guest_notes]: payload.specialRequests,
        [c.room_id]: roomDbIds[i],
        [c.check_in]: payload.checkIn,
        [c.check_out]: payload.checkOut,
        [c.adults]: payload.guests > 0 ? payload.guests : 1,
        [c.price_per_night]: room.price,
        [c.total_amount]: room.price * nights,
      })),
    )
    .select(`${c.id}, ${c.room_id}`);

  if (error) {
    // A3.3 hardening: the `reservations_no_overlap` EXCLUDE constraint rejects a
    // concurrent overlapping booking that slipped past areRoomsAvailable (TOCTOU).
    if ((error as { code?: string }).code === PG_EXCLUSION_VIOLATION) {
      return { ok: false, reason: "conflict" };
    }
    return { ok: false, reason: "error" };
  }

  return { ok: true, reservations: (data ?? []) as PersistedReservationRow[] };
}
