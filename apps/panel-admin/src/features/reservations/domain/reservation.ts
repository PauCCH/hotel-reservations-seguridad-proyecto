export type ReservationStatus = "pending" | "approved" | "cancelled" | "completed";

export type BookingMode = "manual" | "automatic";

export const CHECK_IN_TIME = "3:00 PM" as const;
export const CHECK_OUT_TIME = "11:00 AM" as const;

export interface GuestCount {
  adults: number;
  children?: number;
  pets?: number;
}

export interface Guest {
  name: string;
  email: string;
  phone: string;
  /** Free-text special requests entered by the guest at checkout. */
  notes?: string;
  initials: string;
}

export interface Room {
  name: string;
  location: string;
  category: string;
}

export interface Reservation {
  id: string;
  code: string;
  guest: Guest;
  room: Room;
  guests: GuestCount;
  checkIn: string;
  checkOut: string;
  nights: number;
  pricePerNight: number;
  totalUSD: number;
  currency: string;
  status: ReservationStatus;
  cancellationReason?: string;
}
