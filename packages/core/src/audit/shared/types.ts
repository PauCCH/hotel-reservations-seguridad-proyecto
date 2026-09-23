/**
 * @fileoverview Shared type definitions for the audit module.
 */

export type AuditMetadata = Record<string, unknown>;

export interface AuditEvent {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  metadata?: AuditMetadata;
  ipAddress?: string | null;
  userAgent?: string | null;
}
