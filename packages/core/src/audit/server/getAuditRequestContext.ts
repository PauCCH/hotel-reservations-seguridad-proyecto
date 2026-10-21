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
import { getTrustedProxyHops, resolveClientIp, sanitizeAuditText } from "../shared/sanitize";

export interface AuditRequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Reads the client IP and user-agent from request headers.
 *
 * Forwarding headers are client-controlled, so they are only used when
 * `AUDIT_TRUSTED_PROXY_HOPS` says how many proxies sit in front of the app;
 * the IP is then taken from the proxy-appended end of `x-forwarded-for`
 * (see `resolveClientIp`). The user-agent is stripped of control characters.
 */
export async function getAuditRequestContext(): Promise<AuditRequestContext> {
  const headerList = await headers();

  const ipAddress = resolveClientIp(
    headerList.get("x-forwarded-for"),
    headerList.get("x-real-ip"),
    getTrustedProxyHops(),
  );

  return {
    ipAddress,
    userAgent: sanitizeAuditText(headerList.get("user-agent")),
  };
}
