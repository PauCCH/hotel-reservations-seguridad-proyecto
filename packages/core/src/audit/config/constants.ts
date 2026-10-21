export const AUDIT_ACTIONS = Object.freeze({
  AUTH_LOGIN_SUCCESS: "auth.login.success",
  AUTH_LOGIN_FAILED: "auth.login.failed",
  AUDIT_LOG_VIEWED: "audit.log.viewed",
  AUTH_ACCESS_DENIED: "auth.access.denied",
  USER_INVITED: "user.invited",
  USER_ROLE_CHANGED: "user.role.changed",
  USER_PERMISSION_GRANTED: "user.permission.granted",
  USER_PERMISSION_REVOKED: "user.permission.revoked",
  USER_STATUS_CHANGED: "user.status.changed",
  RESERVATION_CREATED: "reservation.created",
  RESERVATION_UPDATED: "reservation.updated",
  RESERVATION_CANCELLED: "reservation.cancelled",
  RESERVATION_DELETED: "reservation.deleted",
} as const);

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ENTITIES = Object.freeze({
  AUDIT_LOGS: "audit_logs",
  USER: "user",
  PERMISSION: "permission",
  RESERVATION: "reservation",
} as const);

export type AuditEntity = (typeof AUDIT_ENTITIES)[keyof typeof AUDIT_ENTITIES];
