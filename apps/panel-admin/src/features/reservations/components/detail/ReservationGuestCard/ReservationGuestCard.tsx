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
              FIXED (A3.2 / OP-POC-3): render the guest note as TEXT. React
              escapes interpolated strings, so a guest-supplied payload such as
              `<img src=x onerror=...>` is shown literally instead of executing
              in the admin's session. This replaces the previous
              `dangerouslySetInnerHTML` stored-XSS sink. Aligned with F3.2
              (Fabian) and Paula's global CSP as defense in depth.
            */}
            <span className={STYLES.fieldValue}>{guest.notes}</span>
          </div>
        </>
      ) : null}
    </ReservationDetailCard>
  );
};
