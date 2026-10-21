/**
 * @fileoverview Write-time sanitisation for audit events.
 *
 * Audit rows contain attacker-influenced strings (login email, user-agent,
 * forwarded headers). Everything is normalised before it is persisted so a
 * value can't forge extra log lines (CR/LF) or carry control characters.
 * Output escaping is a separate, independent layer handled by the viewer.
 */

import { isIP } from "node:net";

export const AUDIT_MAX_TEXT_LENGTH = 512;
const AUDIT_MAX_METADATA_DEPTH = 4;

// C0/C1 controls (incl. CR, LF, TAB, NUL, DEL) plus Unicode line/paragraph separators.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the whole point
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

export function sanitizeAuditText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return String(value).replace(CONTROL_CHARS, " ").slice(0, AUDIT_MAX_TEXT_LENGTH);
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (typeof value === "string") return sanitizeAuditText(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= AUDIT_MAX_METADATA_DEPTH) return "[truncated]";
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, depth + 1));

  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [
      sanitizeAuditText(key) ?? "",
      sanitizeValue(inner, depth + 1),
    ]),
  );
}

export function sanitizeAuditMetadata(metadata: unknown): Record<string, unknown> {
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return sanitizeValue(metadata, 0) as Record<string, unknown>;
}

/**
 * Picks the client IP from forwarding headers without trusting the part of
 * the chain the client controls. `x-forwarded-for` is appended to by each
 * proxy, so with `trustedProxyHops` proxies in front of the app the real peer
 * is the Nth entry from the RIGHT. With 0 trusted hops the headers are
 * ignored entirely (any client can set them).
 */
export function resolveClientIp(
  forwardedFor: string | null,
  realIp: string | null,
  trustedProxyHops: number,
): string | null {
  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 1) return null;

  let candidate: string | undefined;
  if (forwardedFor) {
    const chain = forwardedFor.split(",").map((entry) => entry.trim());
    candidate = chain[chain.length - trustedProxyHops];
  } else if (realIp) {
    candidate = realIp.trim();
  }

  return sanitizeAuditIp(candidate);
}

export function sanitizeAuditIp(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  return candidate && isIP(candidate) !== 0 ? candidate : null;
}

export function getTrustedProxyHops(): number {
  const parsed = Number.parseInt(process.env.AUDIT_TRUSTED_PROXY_HOPS ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}
