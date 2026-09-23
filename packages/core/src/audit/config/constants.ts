export const AUDIT_ACTIONS = Object.freeze({
  AUTH_LOGIN_SUCCESS: "auth.login.success",
  AUTH_LOGIN_FAILED: "auth.login.failed",
  AUDIT_LOG_VIEWED: "audit.log.viewed",
} as const);

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ENTITIES = Object.freeze({
  AUDIT_LOGS: "audit_logs",
  USER: "user",
} as const);

export type AuditEntity = (typeof AUDIT_ENTITIES)[keyof typeof AUDIT_ENTITIES];
