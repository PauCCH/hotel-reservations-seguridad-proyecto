/**
 * @file ConfirmationView.tsx — Reservation confirmation page orchestrator.
 *
 * Stacks the expanded reservation review, the guest details form and the
 * payment hand-off on a single page. Owns the guest-form and submit hooks and
 * wires their state into the presentational sub-components.
 */

"use client";

import { useI18n } from "@/locales";
import { CHECKOUT_ICON_PATHS } from "../constants/checkout-icons.const";
import type { ConfirmationViewProps } from "../domain/types";
import { useCheckoutSubmit } from "../hooks/useCheckoutSubmit";
import { useGuestForm } from "../hooks/useGuestForm";
import { CHECKOUT_STYLES } from "../theme/checkout.theme";
import { CheckoutHeader } from "./CheckoutHeader";
import { CheckoutIcon } from "./CheckoutIcon";
import { GuestForm } from "./GuestForm";
import { ProceedToPayment } from "./ProceedToPayment";
import { ReservationSummary } from "./ReservationSummary";

export function ConfirmationView({ draft }: ConfirmationViewProps) {
  const { t } = useI18n();
  const { values, errors, setField, validate } = useGuestForm();
  const { isSubmitting, errorKey, submit } = useCheckoutSubmit(draft, values, validate);

  return (
    <div className={CHECKOUT_STYLES.page}>
      <div className={CHECKOUT_STYLES.pageGlow} aria-hidden="true" />
      <CheckoutHeader title={t.CHECKOUT.STEP_LABEL} />

      <main className={CHECKOUT_STYLES.container}>
        <div className={CHECKOUT_STYLES.intro}>
          {draft.isPackage ? (
            <span className={CHECKOUT_STYLES.packageBadge}>
              <CheckoutIcon
                path={CHECKOUT_ICON_PATHS.guests}
                className={CHECKOUT_STYLES.packageBadgeIcon}
              />
              {t.CHECKOUT.PACKAGE_BADGE.replace("{count}", String(draft.rooms.length))}
            </span>
          ) : null}
          <h1 className={CHECKOUT_STYLES.title}>{t.CHECKOUT.PAGE_TITLE}</h1>
          <p className={CHECKOUT_STYLES.subtitle}>{t.CHECKOUT.PAGE_SUBTITLE}</p>
        </div>

        <ReservationSummary draft={draft} />
        <GuestForm values={values} errors={errors} setField={setField} />
        <ProceedToPayment
          draft={draft}
          isSubmitting={isSubmitting}
          error={errorKey ? t.CHECKOUT.PAY_ERROR : null}
          onSubmit={submit}
        />
      </main>
    </div>
  );
}
