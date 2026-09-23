/**
 * @fileoverview Pure formatting helpers for the audit module.
 *
 * Reusable, side-effect-free helpers shared by the audit service and the
 * panel-admin audit-log feature (table cell rendering, detail drawer).
 */

import type { AuditMetadata } from "./types";

/**
 * Builds a dot-namespaced audit action string, e.g. "auth.login.success".
 *
 * @example
 * ```ts
 * buildAuditAction("auth", "login", "success"); // "auth.login.success"
 * ```
 */
export function buildAuditAction(namespace: string, entity: string, outcome: string): string {
  return `${namespace}.${entity}.${outcome}`;
}

/**
 * Formats metadata as a compact "key=value, key2=value2" string for table
 * cells, truncated to `maxLength` characters with an ellipsis.
 *
 * @example
 * ```ts
 * truncateMetadata({ page: 1, search: "abc" }); // "page=1, search=abc"
 * ```
 */
export function truncateMetadata(metadata: AuditMetadata, maxLength = 80): string {
  const entries = Object.entries(metadata ?? {});
  if (entries.length === 0) return "—";

  const joined = entries.map(([key, value]) => `${key}=${String(value)}`).join(", ");
  if (joined.length <= maxLength) return joined;

  return `${joined.slice(0, maxLength)}…`;
}

/**
 * Formats an ISO timestamp for display, using a fixed UTC timezone so
 * output is stable regardless of the host's local timezone.
 *
 * @example
 * ```ts
 * formatAuditTimestamp("2026-01-15T10:30:00.000Z"); // "Jan 15, 2026, 10:30 AM"
 * ```
 */
export function formatAuditTimestamp(iso: string, locale = "en-US"): string {
  if (!iso) return "—";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Renders metadata as a "rich" HTML summary: bold keys, highlighted values,
 * pretty-printed nested objects. Values are interpolated as-is (no HTML
 * escaping) so the consumer can opt into `dangerouslySetInnerHTML`.
 *
 * @example
 * ```ts
 * formatMetadataHtml({ email: "a@b.com" });
 * // '<div class="audit-meta-row"><strong>email</strong><span class="audit-meta-value">a@b.com</span></div>'
 * ```
 */
export function formatMetadataHtml(metadata: AuditMetadata): string {
  const entries = Object.entries(metadata ?? {});
  if (entries.length === 0) return `<p class="audit-meta-empty">—</p>`;

  return entries
    .map(([key, value]) => {
      const rendered =
        typeof value === "object" && value !== null
          ? JSON.stringify(value, null, 2)
          : String(value);
      return `<div class="audit-meta-row"><strong>${key}</strong><span class="audit-meta-value">${rendered}</span></div>`;
    })
    .join("");
}
