"use server";

/**
 * @fileoverview Extracts the client IP and user-agent from the incoming
 * request headers, for attaching to audit events.
 *
 * Every `logAuditEvent` call site should call this once and spread the
 * result into the event, so `ip_address`/`user_agent` are never left null.
 *
 * @example
 * ```ts
 * import { getAuditRequestContext, logAuditEvent } from "@hotel/core/audit";
 *
 * const { ipAddress, userAgent } = await getAuditRequestContext();
 * await logAuditEvent({ action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS, ipAddress, userAgent });
 * ```
 */

import { headers } from "next/headers";

export interface AuditRequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Reads the client IP and user-agent from request headers.
 *
 * `x-forwarded-for` may carry a comma-separated proxy chain — the first
 * entry is the original client — and falls back to `x-real-ip`.
 */
export async function getAuditRequestContext(): Promise<AuditRequestContext> {
  const headerList = await headers();

  const forwardedFor = headerList.get("x-forwarded-for");
  const firstForwarded = forwardedFor?.split(",")[0]?.trim();
  const ipAddress = firstForwarded || headerList.get("x-real-ip");

  return {
    ipAddress: ipAddress ?? null,
    userAgent: headerList.get("user-agent"),
  };
}
