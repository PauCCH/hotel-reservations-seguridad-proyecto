/**
 * @fileoverview Audit package for @hotel/core.
 *
 * Client-safe surface: action/entity catalogs, types and display formatters.
 * The writer (`logAuditEvent`) lives in `@hotel/core/audit/server` so it can
 * never be bundled for, or called from, the browser.
 *
 * @example
 * ```ts
 * import { AUDIT_ACTIONS } from "@hotel/core/audit";
 * import { logAuditEvent } from "@hotel/core/audit/server";
 *
 * await logAuditEvent({
 *   actorId: user.id,
 *   action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
 * });
 * ```
 */

export type { AuditAction, AuditEntity } from "./config/constants";
export { AUDIT_ACTIONS, AUDIT_ENTITIES } from "./config/constants";
export type { AuditEvent, AuditMetadata } from "./shared/types";
export type { AuditMetadataEntry } from "./shared/utils";
export {
  buildAuditAction,
  formatAuditTimestamp,
  formatMetadataEntries,
  truncateMetadata,
} from "./shared/utils";
