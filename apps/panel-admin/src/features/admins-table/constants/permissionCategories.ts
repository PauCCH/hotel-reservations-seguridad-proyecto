import type { PermissionName } from "@hotel/db/types";
import { PERMISSION_CATEGORY_KEYS, PERMISSIONS } from "@/shared/constants/permissions";

export type PermissionCategory = {
  labelKey: Uppercase<keyof typeof PERMISSION_CATEGORY_KEYS>;
  permissions: PermissionName[];
};

/**
 * Permission categories for the permission matrix UI.
 * Groups the 13 permissions into logical categories.
 */
export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    labelKey: PERMISSION_CATEGORY_KEYS.DASHBOARD,
    permissions: [PERMISSIONS.DASHBOARD.VIEW],
  },
  {
    labelKey: PERMISSION_CATEGORY_KEYS.RESERVATIONS,
    permissions: [
      PERMISSIONS.RESERVATIONS.VIEW,
      PERMISSIONS.RESERVATIONS.EDIT,
      PERMISSIONS.RESERVATIONS.DELETE,
    ],
  },
  {
    labelKey: PERMISSION_CATEGORY_KEYS.ADMINS,
    permissions: [
      PERMISSIONS.ADMINS.VIEW,
      PERMISSIONS.ADMINS.INVITE,
      PERMISSIONS.ADMINS.DISABLE,
      PERMISSIONS.ADMINS.REVOKE,
    ],
  },
  {
    labelKey: PERMISSION_CATEGORY_KEYS.PERMISSIONS,
    permissions: [PERMISSIONS.PERMISSIONS.MANAGE],
  },
  {
    labelKey: PERMISSION_CATEGORY_KEYS.CMS,
    permissions: [PERMISSIONS.CMS.MANAGE],
  },
  {
    labelKey: PERMISSION_CATEGORY_KEYS.ROOMS,
    permissions: [PERMISSIONS.ROOMS.MANAGE],
  },
  {
    labelKey: PERMISSION_CATEGORY_KEYS.CLIENTS,
    permissions: [PERMISSIONS.CLIENTS.VIEW],
  },
  {
    labelKey: PERMISSION_CATEGORY_KEYS.INVOICES,
    permissions: [PERMISSIONS.INVOICES.VIEW],
  },
  {
    labelKey: PERMISSION_CATEGORY_KEYS.AUDIT,
    permissions: [PERMISSIONS.AUDIT.VIEW],
  },
];
