/**
 * @file index.ts — Public API barrel for the checkout feature (US-DM-06).
 *
 * The reservation confirmation + payment flow:
 * - ConfirmationView: the /reserve page (review + guest form + pay).
 * - SuccessView: the /reserve/success post-payment screen.
 * - buildReservationDraft: rebuild a reservation from resolved rooms + params.
 * - openGatewaySession: server-side payment-session creation (used by the API route).
 */

export { ConfirmationView } from "./components/ConfirmationView";
export { SuccessView } from "./components/SuccessView";
export {
  CHECKOUT_API_ERROR,
  CHECKOUT_HTTP_STATUS,
  SESSION_ID_PARAM,
} from "./constants/checkout.constants";
export { buildReservationDraft } from "./domain/reservation";
export type { CheckoutSessionPayload, ReservationDraft } from "./domain/types";
export { openGatewaySession } from "./services/gateway.server";
