/**
 * @fileoverview Server-only entry point of the audit package.
 *
 * Import from `@hotel/core/audit/server` in server code only (Server Actions,
 * route handlers, server components). The client-safe surface (constants,
 * types, formatters) stays in `@hotel/core/audit`.
 */

export type { AuditRequestContext } from "./getAuditRequestContext";
export { getAuditRequestContext } from "./getAuditRequestContext";
export { logAuditEvent } from "./logAuditEvent";
