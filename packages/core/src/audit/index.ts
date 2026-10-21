/**
 * @fileoverview Audit package for @hotel/core.
 *
 * Minimal audit-logging service: write events from any server-side flow
 * (`logAuditEvent`) and format them for display (shared/utils).
 *
 * @example
 * ```ts
 * import { AUDIT_ACTIONS, logAuditEvent } from "@hotel/core/audit";
 *
 * await logAuditEvent({
 *   actorId: user.id,
 *   action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
 * });
 * ```
 */

export type { AuditAction, AuditEntity } from "./config/constants";
export { AUDIT_ACTIONS, AUDIT_ENTITIES } from "./config/constants";
export type { AuditRequestContext } from "./server/getAuditRequestContext";
export { getAuditRequestContext } from "./server/getAuditRequestContext";
export { logAuditEvent } from "./server/logAuditEvent";
export type { AuditEvent, AuditMetadata } from "./shared/types";
export type { AuditMetadataEntry } from "./shared/utils";
export {
  buildAuditAction,
  formatAuditTimestamp,
  formatMetadataEntries,
  truncateMetadata,
} from "./shared/utils";
