"use client";

import { useI18n } from "@/locales";
import { Divider } from "../../shared/Divider/Divider";
import { ReservationDetailCard } from "../ReservationDetailCard/ReservationDetailCard";
import type { ReservationGuestCardProps } from "./ReservationGuestCard.interface";
import { RESERVATION_GUEST_CARD_STYLES as STYLES } from "./ReservationGuestCard.styles";

export const ReservationGuestCard = ({ guest }: ReservationGuestCardProps) => {
  const { t } = useI18n();
  const labels = t.RESERVATIONS.DETAIL;

  return (
    <ReservationDetailCard title={labels.SECTION_CLIENT}>
      <p className={STYLES.guestName}>{guest.name}</p>

      <Divider />
      <div className={STYLES.fieldRow}>
        <span className={STYLES.fieldLabel}>{labels.LABEL_EMAIL}</span>
        <span className={STYLES.fieldValue}>{guest.email}</span>
      </div>

      <Divider />
      <div className={STYLES.fieldRow}>
        <span className={STYLES.fieldLabel}>{labels.LABEL_PHONE}</span>
        <span className={STYLES.fieldValue}>{guest.phone}</span>
      </div>

      {guest.notes ? (
        <>
          <Divider />
          <div className={STYLES.fieldRow}>
            <span className={STYLES.fieldLabel}>{labels.LABEL_NOTES}</span>
            {/*
              ⚠️ SECURITY COURSE PROJECT — CONTROLLED VULNERABILITY (OP-POC-3) ⚠️
              Stored XSS: `guest.notes` is free text typed by an anonymous guest
              at checkout (portal) and is rendered here UNESCAPED, so a payload
              like `<img src=x onerror=...>` runs in the authenticated admin's
              session. Introduced per the team decision in
              `docs/proyecto-seguridad/plan-desarrollo.md` §4.1. The Fase 3 fix
              (A3.2) renders this as text — `{guest.notes}` — instead of HTML.
            */}
            <span
              className={STYLES.fieldValue}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: intentional OP-POC-3 sink; fixed in A3.2
              dangerouslySetInnerHTML={{ __html: guest.notes }}
            />
          </div>
        </>
      ) : null}
    </ReservationDetailCard>
  );
};
