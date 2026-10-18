/**
 * @file types.ts — Domain types for the checkout feature (US-DM-06).
 *
 * Pure TypeScript: no React runtime, no JSX. Room data is consumed from the
 * rooms feature via its public barrel.
 */

import type { Room } from "@/features/rooms";
import type { GUEST_ERROR_CODE } from "../constants/checkout.constants";

/** A guest's reservation contact details (no account required). */
export interface GuestDetails {
  fullName: string;
  email: string;
  phone: string;
  specialRequests: string;
  acceptedTerms: boolean;
}

/** The guest fields that are validated before payment. */
export type GuestFieldName = "fullName" | "email" | "phone" | "acceptedTerms";

/** Stable validation failure code (mapped to localized text in the UI). */
export type GuestErrorCode = (typeof GUEST_ERROR_CODE)[keyof typeof GUEST_ERROR_CODE];

/** Validation errors keyed by field, holding a stable error code. */
export type GuestFormErrors = Partial<Record<GuestFieldName, GuestErrorCode>>;

/** A fully-resolved reservation ready to confirm and pay. */
export interface ReservationDraft {
  /** Rooms being reserved: one for a single room, many for a package. */
  rooms: Room[];
  /** Whether the reservation is a multi-room package. */
  isPackage: boolean;
  /** ISO check-in date (YYYY-MM-DD). */
  checkIn: string;
  /** ISO check-out date (YYYY-MM-DD). */
  checkOut: string;
  /** Total guest count. */
  guests: number;
  /** Number of nights between check-in and check-out. */
  nights: number;
  /** Total stay price: sum of room prices times nights. */
  total: number;
}

/** Payload sent to the checkout API to open a payment session. */
export interface CheckoutSessionPayload {
  roomIds: string[];
  checkIn: string;
  checkOut: string;
  guests: number;
  email: string;
  fullName: string;
  phone: string;
  /** Optional free-text special requests entered by the guest. */
  specialRequests: string;
}

/** Response from the checkout API: the URL to redirect the browser to. */
export interface CheckoutSessionResult {
  url: string;
}

/** Inputs for building the Stripe Checkout Session form parameters. */
export interface StripeCheckoutInput {
  rooms: Room[];
  nights: number;
  email: string;
  successUrl: string;
  cancelUrl: string;
}

// ─── Component Props ─────────────────────────────────────────────────────────

export interface ConfirmationViewProps {
  draft: ReservationDraft;
}

export interface ReservationSummaryProps {
  draft: ReservationDraft;
}

export interface SummaryRoomCardProps {
  room: Room;
  /** 1-based position within a package; omitted for a single room. */
  position?: number;
  /** Total rooms in the package; omitted for a single room. */
  total?: number;
}

export interface StayMetaProps {
  draft: ReservationDraft;
}

export interface PriceBreakdownProps {
  draft: ReservationDraft;
}

export interface GuestFormProps {
  values: GuestDetails;
  errors: GuestFormErrors;
  setField: (field: keyof GuestDetails, value: string | boolean) => void;
}

export interface GuestFieldProps {
  id: string;
  label: string;
  value: string;
  type?: "text" | "email" | "tel";
  placeholder?: string;
  /** Localized error text, or undefined when the field is valid. */
  error?: string;
  multiline?: boolean;
  required?: boolean;
  /** Spans the full form width (both grid columns). */
  fullWidth?: boolean;
  onChange: (value: string) => void;
}

export interface TermsAcceptanceProps {
  checked: boolean;
  error?: string;
  onChange: (checked: boolean) => void;
}

export interface ProceedToPaymentProps {
  draft: ReservationDraft;
  isSubmitting: boolean;
  /** Localized payment error, or null when there is none. */
  error: string | null;
  onSubmit: () => void;
}

export interface SuccessViewProps {
  /** Payment-gateway session ID echoed back on success (drives the code). */
  sessionId: string;
}

export interface CheckoutHeaderProps {
  /** Short step label shown next to the brand. */
  title: string;
}

export interface CheckoutIconProps {
  /** SVG path data from CHECKOUT_ICON_PATHS. */
  path: string;
  className: string;
}

// ─── Hook return types ───────────────────────────────────────────────────────

export interface UseGuestFormReturn {
  values: GuestDetails;
  errors: GuestFormErrors;
  setField: (field: keyof GuestDetails, value: string | boolean) => void;
  validate: () => boolean;
}

export interface UseCheckoutSubmitReturn {
  isSubmitting: boolean;
  errorKey: string | null;
  submit: () => void;
}
