/**
 * @file translations.ts — App-level i18n translation registry.
 *
 * Aggregates all feature-level translation modules into a single typed map.
 * Each feature owns its own i18n/ folder with a .texts.ts (data) and .type.ts (type).
 * This file assembles them under the AppTranslations type so useI18n() provides
 * compile-time validation on keys like t.AUTH.LOGIN.TITLE.
 */

import type { SupportedLocale } from "@hotel/i18n";
import { useI18n as _useI18n, LOCALES } from "@hotel/i18n";
import { AUTH_TEXTS } from "@/features/auth/i18n/auth.texts";
import type { AuthTexts } from "@/features/auth/i18n/authTexts.type";
import { CHECKOUT_TEXTS } from "@/features/checkout/i18n/checkout.texts";
import type { CheckoutTexts } from "@/features/checkout/i18n/checkoutTexts.type";
import { LAYOUT_TEXTS } from "@/features/layout/i18n/layout.texts";
import type { LayoutTexts } from "@/features/layout/i18n/layoutTexts.type";
import { RESERVATION_LOOKUP_TEXTS } from "@/features/reservation-lookup/i18n/reservationLookup.texts";
import type { ReservationLookupTexts } from "@/features/reservation-lookup/i18n/reservationLookupTexts.type";
import { ROOM_DETAIL_TEXTS } from "@/features/room-detail/i18n/roomDetail.texts";
import type { RoomDetailTexts } from "@/features/room-detail/i18n/roomDetailTexts.type";
import { ROOMS_TEXTS } from "@/features/rooms/i18n/rooms.texts";
import type { RoomsTexts } from "@/features/rooms/i18n/roomsTexts.type";
import { SEARCH_TEXTS } from "@/features/search/i18n/search.texts";
import type { SearchTexts } from "@/features/search/i18n/searchTexts.type";
import { COMMON_TEXTS } from "@/shared/i18n/commonTexts";
import type { CommonTexts } from "@/shared/i18n/commonTexts.type";

/**
 * The complete translation shape for the portal-reservas app.
 * Each key maps to a feature's translation type.
 */
export type AppTranslations = {
  COMMON: CommonTexts;
  AUTH: AuthTexts;
  LAYOUT: LayoutTexts;
  SEARCH: SearchTexts;
  ROOMS: RoomsTexts;
  ROOM_DETAIL: RoomDetailTexts;
  CHECKOUT: CheckoutTexts;
  RESERVATION_LOOKUP: ReservationLookupTexts;
};

/**
 * Translation data for each supported locale.
 * Adding a new locale requires adding a new entry here with all feature texts.
 */
export const TRANSLATIONS: Record<SupportedLocale, AppTranslations> = {
  [LOCALES.ES]: {
    COMMON: COMMON_TEXTS.es,
    AUTH: AUTH_TEXTS.es,
    LAYOUT: LAYOUT_TEXTS.es,
    SEARCH: SEARCH_TEXTS.es,
    ROOMS: ROOMS_TEXTS.es,
    ROOM_DETAIL: ROOM_DETAIL_TEXTS.es,
    CHECKOUT: CHECKOUT_TEXTS.es,
    RESERVATION_LOOKUP: RESERVATION_LOOKUP_TEXTS.es,
  },
  [LOCALES.EN]: {
    COMMON: COMMON_TEXTS.en,
    AUTH: AUTH_TEXTS.en,
    LAYOUT: LAYOUT_TEXTS.en,
    SEARCH: SEARCH_TEXTS.en,
    ROOMS: ROOMS_TEXTS.en,
    ROOM_DETAIL: ROOM_DETAIL_TEXTS.en,
    CHECKOUT: CHECKOUT_TEXTS.en,
    RESERVATION_LOOKUP: RESERVATION_LOOKUP_TEXTS.en,
  },
};

/** Cookie name used to persist the user's locale preference. */
export const LOCALE_COOKIE_NAME = "locale";

/** Default locale for the app (Spanish). */
export const defaultLocale = LOCALES.ES;

/**
 * Typed wrapper around the generic useI18n hook from @hotel/i18n.
 * Provides full IDE autocomplete on t.AUTH.LOGIN.TITLE, t.SEARCH.HERO.TITLE, etc.
 */
export const useI18n = () => _useI18n<AppTranslations>();
