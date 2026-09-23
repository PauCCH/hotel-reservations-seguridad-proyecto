"use server";

/**
 * @fileoverview Server-side audit event writer.
 *
 * Records one row in `audit_logs` via the service-role Supabase client.
 * Never throws into the caller — a failed audit write must not break the
 * flow that triggered it (e.g. login).
 *
 * @example
 * ```ts
 * import { AUDIT_ACTIONS, logAuditEvent } from "@hotel/core/audit";
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
      actor_email: event.actorEmail ?? null,
      action: event.action,
      entity: event.entity ?? null,
      entity_id: event.entityId ?? null,
      metadata: (event.metadata ?? {}) as Json,
      ip_address: event.ipAddress ?? null,
      user_agent: event.userAgent ?? null,
    });

    if (error) {
      console.error("[audit] insert failed:", error.message);
    }
  } catch (err) {
    console.error("[audit] insert threw:", err);
  }
}
