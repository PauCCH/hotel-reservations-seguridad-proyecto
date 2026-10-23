import { describe, expect, it } from "vitest";
import {
  applySecurityHeaders,
  buildContentSecurityPolicy,
  CSP_HEADER,
  createNonce,
  NONCE_HEADER,
  prepareSecurityHeaders,
} from "./index";

function directive(csp: string, name: string): string[] {
  const entry = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `));
  return entry ? entry.split(/\s+/).slice(1) : [];
}

describe("createNonce", () => {
  it("returns a fresh base64 value of 16 bytes each time", () => {
    const a = createNonce();
    const b = createNonce();

    expect(a).not.toBe(b);
    expect(atob(a)).toHaveLength(16);
  });
});

describe("buildContentSecurityPolicy (P3.2)", () => {
  const csp = buildContentSecurityPolicy({
    nonce: "abc123",
    isDev: false,
    supabaseUrl: "https://project.supabase.co/rest/v1",
    imgSrc: ["https://images.unsplash.com"],
  });

  it("allows only nonced scripts: no 'unsafe-inline' (blocks onerror= payloads like AUTH-POC-4)", () => {
    const scriptSrc = directive(csp, "script-src");

    expect(scriptSrc).toContain("'nonce-abc123'");
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("locks down plugins, base URI, form targets and framing", () => {
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
    expect(directive(csp, "base-uri")).toEqual(["'self'"]);
    expect(directive(csp, "form-action")).toEqual(["'self'"]);
    expect(directive(csp, "frame-ancestors")).toEqual(["'none'"]);
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("allows the Supabase origin (HTTP + WebSocket) and the given image CDNs", () => {
    expect(directive(csp, "connect-src")).toEqual([
      "'self'",
      "https://project.supabase.co",
      "wss://project.supabase.co",
    ]);
    expect(directive(csp, "img-src")).toContain("https://images.unsplash.com");
    expect(directive(csp, "img-src")).toContain("https://project.supabase.co");
  });

  it("adds 'unsafe-eval' and drops upgrade-insecure-requests only in development", () => {
    const dev = buildContentSecurityPolicy({ nonce: "n", isDev: true });

    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });

  it("ignores an invalid Supabase URL instead of emitting it", () => {
    const noUrl = buildContentSecurityPolicy({
      nonce: "n",
      isDev: false,
      supabaseUrl: "not a url",
    });

    expect(directive(noUrl, "connect-src")).toEqual(["'self'"]);
  });
});

describe("prepareSecurityHeaders / applySecurityHeaders", () => {
  it("puts the same nonce and CSP on the request and the response", () => {
    const incoming = new Headers({ cookie: "a=b" });
    const { requestHeaders, csp, nonce } = prepareSecurityHeaders(incoming, { isDev: false });

    expect(requestHeaders.get(NONCE_HEADER)).toBe(nonce);
    expect(requestHeaders.get(CSP_HEADER)).toBe(csp);
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(requestHeaders.get("cookie")).toBe("a=b");
    expect(incoming.get(CSP_HEADER)).toBeNull();

    const response = new Headers();
    applySecurityHeaders(response, csp, false);

    expect(response.get(CSP_HEADER)).toBe(csp);
    expect(response.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.get("X-Frame-Options")).toBe("DENY");
    expect(response.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(response.get("Strict-Transport-Security")).toContain("max-age=");
  });

  it("omits HSTS in development (plain http://localhost)", () => {
    const response = new Headers();
    applySecurityHeaders(response, "default-src 'self'", true);

    expect(response.get("Strict-Transport-Security")).toBeNull();
  });
});
