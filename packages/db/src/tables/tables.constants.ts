import type { Database } from "../database.types";
import type { DBTableName } from "../tables/tables.types";

const _DB_TABLES = {
  AMENITIES: "amenities",
  AUDIT_LOGS: "audit_logs",
  CMS_CONTENT: "cms_content",
  PENDING_INVITATIONS: "pending_invitations",
  PROFILES: "profiles",
  RESERVATIONS: "reservations",
  ROOM_AMENITIES: "room_amenities",
  ROOM_IMAGES: "room_images",
  ROOMS: "rooms",
  SYSTEM_SETTINGS: "system_settings",
  USER_PERMISSIONS: "user_permissions",
  USER_ROLES: "user_roles",
} as const;

export const DB_TABLES = _DB_TABLES satisfies Record<Uppercase<DBTableName>, DBTableName>;

type _AssertAllTablesCovered = {
  [K in keyof Database["public"]["Tables"]]: (typeof _DB_TABLES)[Uppercase<K>] extends K
    ? true
    : never;
};

const _assertAllTablesCovered: _AssertAllTablesCovered = {
  amenities: true,
  audit_logs: true,
  cms_content: true,
  pending_invitations: true,
  profiles: true,
  reservations: true,
  room_amenities: true,
  room_images: true,
  rooms: true,
  system_settings: true,
  user_permissions: true,
  user_roles: true,
};
