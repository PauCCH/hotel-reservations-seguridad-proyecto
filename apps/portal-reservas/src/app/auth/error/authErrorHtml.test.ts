/**
 * @file authErrorHtml.test.ts — Regression test for AUTH-POC-4.
 *
 * Asserts that `buildErrorDescriptionHtml` returns the raw, unescaped
 * `error_description` query value inside a `{ __html }` object — the payload
 * that `AuthErrorContent.tsx` feeds to `dangerouslySetInnerHTML`, i.e. the
 * reflected-XSS sink (OWASP A03/Vector 2). See `authErrorHtml.ts` for the full
 * writeup and `docs/proyecto-seguridad/auth/fase-2-pocs.md` (AUTH-POC-4) for the
 * live reproduction over HTTP.
 *
 * This test is expected to start FAILING once P3.2 renders the detail as plain
 * text (no `{ __html }` / `dangerouslySetInnerHTML`) — that is the regression
 * signal Fase 3 needs.
 */

import { describe, expect, it } from "vitest";
import { buildErrorDescriptionHtml } from "./authErrorHtml";

describe("buildErrorDescriptionHtml (AUTH-POC-4)", () => {
  it("returns null when there is no error_description", () => {
    expect(buildErrorDescriptionHtml({})).toBeNull();
    expect(buildErrorDescriptionHtml({ error: "access_denied" })).toBeNull();
    expect(buildErrorDescriptionHtml({ error_description: "" })).toBeNull();
  });

  it("passes the raw, unescaped value straight into __html", () => {
    const result = buildErrorDescriptionHtml({ error_description: "Session expired" });
    expect(result).toEqual({ __html: "Session expired" });
  });

  it("does not sanitize an XSS payload — the reflected-XSS sink", () => {
    // A crafted link: /auth/error?error_description=<img src=x onerror=...>
    const payload = "<img src=x onerror=alert(document.cookie)>";

    const result = buildErrorDescriptionHtml({ error_description: payload });

    // The script-bearing markup survives verbatim; nothing is escaped, so React
    // injects it into the DOM via dangerouslySetInnerHTML and the browser runs it.
    expect(result).toEqual({ __html: payload });
    expect(result?.__html).toContain("onerror=");
  });
});
