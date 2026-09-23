import type { Database } from "../database.types";
import type { DBTablesWithColumns } from "./columns.types";

export const DB_COLUMNS: DBTablesWithColumns = {
  audit_logs: {
    id: "id",
    actor_id: "actor_id",
    actor_email: "actor_email",
    action: "action",
    entity: "entity",
    entity_id: "entity_id",
    metadata: "metadata",
    ip_address: "ip_address",
    user_agent: "user_agent",
    created_at: "created_at",
  },
  amenities: {
    created_at: "created_at",
    description: "description",
    icon: "icon",
    id: "id",
    name: "name",
    updated_at: "updated_at",
  },
  cms_content: {
    id: "id",
    locale: "locale",
    section: "section",
    content: "content",
    updated_at: "updated_at",
  },
  pending_invitations: {
    accepted_at: "accepted_at",
    created_at: "created_at",
    email: "email",
    expires_at: "expires_at",
    id: "id",
    invited_by: "invited_by",
    revoked_at: "revoked_at",
    revoked_by: "revoked_by",
    status: "status",
    user_id: "user_id",
  },
  profiles: {
    full_name: "full_name",
    id: "id",
    is_active: "is_active",
  },
  reservations: {
    id: "id",
    code: "code",
    user_id: "user_id",
    guest_name: "guest_name",
    guest_email: "guest_email",
    guest_phone: "guest_phone",
    room_id: "room_id",
    check_in: "check_in",
    check_out: "check_out",
    adults: "adults",
    children: "children",
    pets: "pets",
    price_per_night: "price_per_night",
    total_amount: "total_amount",
    currency: "currency",
    status: "status",
    cancellation_reason: "cancellation_reason",
    created_at: "created_at",
    updated_at: "updated_at",
  },
  room_amenities: {
    amenity_id: "amenity_id",
    created_at: "created_at",
    room_id: "room_id",
  },
  room_images: {
    created_at: "created_at",
    id: "id",
    position: "position",
    room_id: "room_id",
    storage_path: "storage_path",
    url: "url",
  },
  rooms: {
    capacity_adults: "capacity_adults",
    capacity_kids: "capacity_kids",
    category: "category",
    created_at: "created_at",
    description: "description",
    high_season_fee: "high_season_fee",
    id: "id",
    is_active: "is_active",
    is_pet_friendly: "is_pet_friendly",
    name: "name",
    regular_fee: "regular_fee",
    updated_at: "updated_at",
  },
  system_settings: {
    id: "id",
    setting_key: "setting_key",
    setting_value: "setting_value",
    updated_at: "updated_at",
  },
  user_permissions: {
    user_id: "user_id",
    permission: "permission",
    granted_by: "granted_by",
    created_at: "created_at",
  },
  user_roles: {
    role: "role",
    user_id: "user_id",
  },
} as const;

type _AssertAllColumnsCovered = {
  [Table in keyof Database["public"]["Tables"]]: keyof Database["public"]["Tables"][Table]["Row"] extends keyof (typeof DB_COLUMNS)[Table]
    ? true
    : never;
};

const _assertAllColumnsCovered: _AssertAllColumnsCovered = {
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
