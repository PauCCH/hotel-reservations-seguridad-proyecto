/**
 * @file page.tsx — Public "find my reservation" route (/reservations/lookup).
 *
 * Server component shell; all interactivity lives in `ReservationLookupForm`.
 * See `lookupReservation.server.ts` for the OP-POC-1 controlled vulnerability
 * this page exists to demonstrate (operations module, Fase 2, Vector 1).
 */

import { ReservationLookupForm } from "@/features/reservation-lookup";

export default function ReservationLookupPage() {
  return <ReservationLookupForm />;
}
