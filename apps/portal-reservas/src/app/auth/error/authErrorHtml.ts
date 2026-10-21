/**
 * @file authErrorHtml.ts — "rich" auth error detail rendering.
 *
 * ⚠️ SECURITY COURSE PROJECT — CONTROLLED VULNERABILITY (AUTH-POC-4) ⚠️
 * Introduced deliberately per the team decision in
 * `docs/proyecto-seguridad/plan-desarrollo.md` §4.1, because the auth module
 * had no real XSS sink: the portal renders every auth value with plain JSX
 * (`{errorCode}`, `{description}`), which React escapes by default, so the real
 * finding O-04 (`/auth/error` reflects `error` / `error_description`) is only
 * text/phishing injection, NOT script execution. To demonstrate the Vector 2
 * (client-side XSS) requirement of P2.2, this turns that same reflected value
 * into a real reflected XSS by rendering it as HTML.
 *
 * Mirrors the sibling controlled/real XSS sinks already in the repo:
 *   - Operations: `ReservationGuestCard.tsx` (`__html: guest.notes`, OP-POC-3).
 *   - Audit (real): `AuditLogDetailDrawer.tsx` (`formatMetadataHtml`, AU-POC).
 *
 * THE BUG: the attacker-controlled `error_description` query parameter is
 * returned inside a `{ __html }` object and fed to `dangerouslySetInnerHTML`
 * (see `AuthErrorContent.tsx`), so a crafted link such as
 *   /auth/error?error_description=<img src=x onerror=alert(document.cookie)>
 * executes script in the victim's browser. Because the app sets no CSP and the
 * session cookies are readable from JS (finding O-10), this is a session-theft
 * primitive, not just an alert box.
 *
 * DO NOT replicate this pattern. The Fase 3 fix (P3.2) must render the detail
 * as plain text (drop `dangerouslySetInnerHTML`) and add a CSP.
 */

import type { AuthErrorSearchParams } from "./page.interface";

/** Matches `CALLBACK_SEARCH_PARAMS.ERROR_DESCRIPTION`; inlined so this helper
 * (and its regression test) stay free of the `@/` path alias, which vitest
 * does not resolve. */
const ERROR_DESCRIPTION_PARAM = "error_description";

/**
 * Builds the `dangerouslySetInnerHTML` payload for the optional error detail.
 *
 * Returns `null` when there is no `error_description` to show, otherwise a
 * `{ __html }` object with the raw, unescaped query value.
 */
export function buildErrorDescriptionHtml(
  searchParams: AuthErrorSearchParams,
): { __html: string } | null {
  const raw = searchParams?.[ERROR_DESCRIPTION_PARAM];

  if (typeof raw !== "string" || raw.length === 0) {
    return null;
  }

  // VULNERABLE: the raw query value is rendered as HTML instead of text.
  // The fix (P3.2) is to render `raw` inside JSX (`<p>{raw}</p>`), which React
  // escapes, and to stop returning a `{ __html }` object here.
  return { __html: raw };
}
