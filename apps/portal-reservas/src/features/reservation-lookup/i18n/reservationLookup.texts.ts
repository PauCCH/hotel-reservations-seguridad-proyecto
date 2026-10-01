import type { SupportedLocale } from "@hotel/i18n";
import type { ReservationLookupTexts } from "./reservationLookupTexts.type";

export const RESERVATION_LOOKUP_TEXTS: Record<SupportedLocale, ReservationLookupTexts> = {
  es: {
    PAGE_TITLE: "Consulta tu reserva",
    PAGE_SUBTITLE: "Ingresa tu código de reserva y el correo con el que reservaste.",
    CODE_LABEL: "Código de reserva",
    CODE_PLACEHOLDER: "RES-001",
    EMAIL_LABEL: "Correo electrónico",
    EMAIL_PLACEHOLDER: "tucorreo@ejemplo.com",
    SUBMIT: "Buscar reserva",
    SUBMIT_PENDING: "Buscando…",
    EMPTY_RESULT: "No encontramos ninguna reserva con esos datos.",
    GENERIC_ERROR: "Ocurrió un error al buscar tu reserva. Intenta de nuevo.",
    RESULT_STATUS_LABEL: "Estado",
    RESULT_STAY_LABEL: "Estadía",
    RESULT_TOTAL_LABEL: "Total",
  },
  en: {
    PAGE_TITLE: "Find your reservation",
    PAGE_SUBTITLE: "Enter your reservation code and the email you booked with.",
    CODE_LABEL: "Reservation code",
    CODE_PLACEHOLDER: "RES-001",
    EMAIL_LABEL: "Email",
    EMAIL_PLACEHOLDER: "you@example.com",
    SUBMIT: "Find reservation",
    SUBMIT_PENDING: "Searching…",
    EMPTY_RESULT: "We couldn't find a reservation with that information.",
    GENERIC_ERROR: "Something went wrong while searching. Please try again.",
    RESULT_STATUS_LABEL: "Status",
    RESULT_STAY_LABEL: "Stay",
    RESULT_TOTAL_LABEL: "Total",
  },
};
