import type { Database } from "../database.types";

type ReplaceColonWithUnderscore<T extends string> = T extends `${infer A}:${infer B}`
  ? `${A}_${ReplaceColonWithUnderscore<B>}`
  : T;

export const DB_ENUMS: {
  [Enum in keyof Database["public"]["Enums"]]: {
    [Value in Database["public"]["Enums"][Enum] as ReplaceColonWithUnderscore<Value>]: Value;
  };
} = {
  invitation_status: {
    accepted: "accepted",
    expired: "expired",
    pending: "pending",
    revoked: "revoked",
  },

  user_permission: {
    view_dashboard: "view:dashboard",
    reservations_view: "reservations:view",
    reservations_edit: "reservations:edit",
    reservations_delete: "reservations:delete",
    admins_view: "admins:view",
    admins_invite: "admins:invite",
    admins_disable: "admins:disable",
    admins_revoke: "admins:revoke",
    cms_manage: "cms:manage",
    permissions_manage: "permissions:manage",
    rooms_manage: "rooms:manage",
    invoices_view: "invoices:view",
    clients_view: "clients:view",
    audit_view: "audit:view",
  },

  user_role: {
    admin: "admin",
    client: "client",
    owner: "owner",
  },
};
