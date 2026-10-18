/**
 * @file types.ts — Domain types for the public "find my reservation" lookup.
 */

export interface ReservationLookupInput {
  code: string;
  email: string;
}

export interface ReservationLookupResult {
  code: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  status: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  currency: string;
}
