/**
 * @file layout.tsx — Next.js root layout for Portal de Reservas.
 *
 * Sets the `<html>` lang to the default locale from `@/locales` and applies
 * base body styles. Wraps all children in the `I18nProvider` from `@hotel/i18n`
 * to enable internationalization across the application. The `globals.css`
 * import pulls in Tailwind's base layer and any global custom CSS.
 *
 * Reading the request headers opts every page into dynamic rendering, which the
 * per-request CSP nonce set by `middleware.ts` requires (P3.2): a statically
 * prerendered page would ship scripts without the nonce and the CSP would block them.
 */

import { I18nProvider } from "@hotel/i18n";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { defaultLocale, TRANSLATIONS } from "@/locales";
import { ROOT_LAYOUT_STYLES as S } from "@/theme/layout.theme";
import "./globals.css";

/** SEO metadata for the application. */
export const metadata: Metadata = {
  title: "Portal de Reservas",
  description: "Sistema de reservas hoteleras",
};

import { dmSans, playfair } from "@/config/fonts";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers();

  return (
    <html lang={defaultLocale} className={`dark ${playfair.variable} ${dmSans.variable}`}>
      <body className={S.body}>
        <div className={S.grainOverlay} aria-hidden="true" />
        <I18nProvider defaultLocale={defaultLocale} translations={TRANSLATIONS}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
