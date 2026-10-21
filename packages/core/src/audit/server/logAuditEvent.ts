/**
 * @fileoverview Server-side audit event writer.
 *
 * Records one row in `audit_logs` via the service-role Supabase client.
 * Deliberately NOT a Server Action (no "use server"): that would expose it as a
 * public HTTP endpoint any client could use to forge audit events. Import it
 * only from server code via `@hotel/core/audit/server`.
 * Never throws into the caller — a failed audit write must not break the
 * flow that triggered it (e.g. login).
 *
 * @example
 * ```ts
 * import { AUDIT_ACTIONS } from "@hotel/core/audit";
 * import { logAuditEvent } from "@hotel/core/audit/server";
 *
 * await logAuditEvent({
 *   actorId: user.id,
 *   actorEmail: user.email,
 *   action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
 * });
 * ```
 */

import type { Json } from "@hotel/db";
import { createSupabaseServiceClient, DB_TABLES } from "@hotel/db";
import { sanitizeAuditIp, sanitizeAuditMetadata, sanitizeAuditText } from "../shared/sanitize";
import type { AuditEvent } from "../shared/types";

/**
 * Persists an audit event. Errors are swallowed and logged via
 * `console.error` — this function never throws.
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const supabase = createSupabaseServiceClient();

    const { error } = await supabase.from(DB_TABLES.AUDIT_LOGS).insert({
      actor_id: event.actorId ?? null,
      actor_email: sanitizeAuditText(event.actorEmail),
      action: sanitizeAuditText(event.action) ?? event.action,
      entity: sanitizeAuditText(event.entity),
      entity_id: sanitizeAuditText(event.entityId),
      metadata: sanitizeAuditMetadata(event.metadata) as Json,
      ip_address: sanitizeAuditIp(event.ipAddress),
      user_agent: sanitizeAuditText(event.userAgent),
    });

    if (error) {
      console.error("[audit] insert failed:", error.message);
    }
  } catch (err) {
    console.error("[audit] insert threw:", err);
  }
}
