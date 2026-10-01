/**
 * @file ReservationLookupForm.tsx — Public "find my reservation" form.
 *
 * Posts to `/api/reservations/lookup`. See `lookupReservation.server.ts` for
 * the OP-POC-1 controlled vulnerability this surface exists to demonstrate.
 */

"use client";

import { useState } from "react";
import { ROUTES } from "@/config/routes";
import { useI18n } from "@/locales";
import type { ReservationLookupResult } from "../domain/types";

export function ReservationLookupForm() {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [results, setResults] = useState<ReservationLookupResult[] | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsPending(true);
    setErrorMessage(null);
    setResults(null);

    try {
      const response = await fetch(ROUTES.API.RESERVATIONS_LOOKUP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, email }),
      });
      const payload = (await response.json()) as { results: ReservationLookupResult[] };
      setResults(payload.results ?? []);
    } catch {
      setErrorMessage(t.RESERVATION_LOOKUP.GENERIC_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold text-neutral-900">{t.RESERVATION_LOOKUP.PAGE_TITLE}</h1>
      <p className="mt-1 text-sm text-neutral-600">{t.RESERVATION_LOOKUP.PAGE_SUBTITLE}</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          {t.RESERVATION_LOOKUP.CODE_LABEL}
          <input
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            placeholder={t.RESERVATION_LOOKUP.CODE_PLACEHOLDER}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          {t.RESERVATION_LOOKUP.EMAIL_LABEL}
          <input
            type="email"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            placeholder={t.RESERVATION_LOOKUP.EMAIL_PLACEHOLDER}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isPending ? t.RESERVATION_LOOKUP.SUBMIT_PENDING : t.RESERVATION_LOOKUP.SUBMIT}
        </button>
      </form>

      {errorMessage && <p className="mt-4 text-sm text-red-600">{errorMessage}</p>}

      {results && results.length === 0 && (
        <p className="mt-4 text-sm text-neutral-600">{t.RESERVATION_LOOKUP.EMPTY_RESULT}</p>
      )}

      {results && results.length > 0 && (
        <ul className="mt-6 flex flex-col gap-3">
          {results.map((r) => (
            <li key={r.code} className="rounded-md border border-neutral-200 p-4 text-sm">
              <p className="font-semibold">{r.code}</p>
              <p>{r.guestName}</p>
              <p>{r.guestEmail}</p>
              <p>{r.guestPhone}</p>
              <p>
                {t.RESERVATION_LOOKUP.RESULT_STATUS_LABEL}: {r.status}
              </p>
              <p>
                {t.RESERVATION_LOOKUP.RESULT_STAY_LABEL}: {r.checkIn} → {r.checkOut}
              </p>
              <p>
                {t.RESERVATION_LOOKUP.RESULT_TOTAL_LABEL}: {r.totalAmount} {r.currency}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
