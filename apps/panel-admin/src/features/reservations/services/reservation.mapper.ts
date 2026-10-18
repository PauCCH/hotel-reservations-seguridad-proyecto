import type { Reservation, ReservationStatus } from "../domain/reservation";
import { computeNights, getInitials } from "../utils/reservation-utils";

export type DbReservation = {
  id: string;
  code: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  guest_notes: string | null;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  pets: number;
  price_per_night: number;
  total_amount: number;
  currency: string;
  status: string;
  cancellation_reason: string | null;
  rooms: { name: string; category: string } | null;
};

export type ReservationStatusUpdate = {
  status: string;
  updated_at: string;
  cancellation_reason?: string;
};

export function mapToReservation(row: DbReservation): Reservation {
  return {
    id: row.id,
    code: row.code,
    guest: {
      name: row.guest_name,
      email: row.guest_email,
      phone: row.guest_phone,
      notes: row.guest_notes ?? "",
      initials: getInitials(row.guest_name),
    },
    room: {
      name: row.rooms?.name ?? "",
      location: "",
      category: row.rooms?.category ?? "",
    },
    guests: {
      adults: row.adults,
      ...(row.children > 0 && { children: row.children }),
      ...(row.pets > 0 && { pets: row.pets }),
    },
    checkIn: row.check_in,
    checkOut: row.check_out,
    nights: computeNights(row.check_in, row.check_out),
    pricePerNight: Number(row.price_per_night),
    totalUSD: Number(row.total_amount),
    currency: row.currency,
    status: row.status as ReservationStatus,
    ...(row.cancellation_reason && { cancellationReason: row.cancellation_reason }),
  };
}
