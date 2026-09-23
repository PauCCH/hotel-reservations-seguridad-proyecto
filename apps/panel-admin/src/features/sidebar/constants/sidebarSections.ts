import {
  BarChart2,
  BedDouble,
  ClipboardList,
  History,
  KeyRound,
  LayoutDashboard,
  LayoutPanelTop,
  Receipt,
  UserPlus,
  UserRound,
} from "lucide-react";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/shared/constants/permissions";
import type { SidebarSection } from "../types/sidebarSection";
import { LABEL_KEYS } from "./labelKeys";
import { SECTION_KEYS } from "./sectionKeys";

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    sectionKey: SECTION_KEYS.ADMINISTRATION,
    items: [
      {
        labelKey: LABEL_KEYS.DASHBOARD,
        route: ROUTES.ADMIN.DASHBOARD,
        icon: LayoutDashboard,
        isPrimary: true,
        requiredPermission: PERMISSIONS.DASHBOARD.VIEW,
      },
      {
        labelKey: LABEL_KEYS.ADMINS,
        route: ROUTES.ADMIN.ADMINS,
        icon: KeyRound,
        isPrimary: true,
        requiredPermission: PERMISSIONS.ADMINS.VIEW,
      },
      {
        labelKey: LABEL_KEYS.INVITATIONS,
        route: ROUTES.ADMIN.INVITATIONS,
        icon: UserPlus,
        isPrimary: true,
        requiredPermission: PERMISSIONS.ADMINS.INVITE,
      },
      {
        labelKey: LABEL_KEYS.METRICS_DASHBOARD,
        route: ROUTES.ADMIN.METRICS_DASHBOARD,
        icon: BarChart2,
        isPrimary: true,
      },
      {
        labelKey: LABEL_KEYS.AUDIT_LOG,
        route: ROUTES.ADMIN.AUDIT_LOG,
        icon: History,
        isPrimary: true,
        requiredPermission: PERMISSIONS.AUDIT.VIEW,
      },
    ],
  },
  {
    sectionKey: SECTION_KEYS.RESERVATIONS,
    items: [
      {
        labelKey: LABEL_KEYS.RESERVATIONS,
        route: ROUTES.ADMIN.RESERVATIONS,
        icon: ClipboardList,
        isPrimary: true,
        requiredPermission: PERMISSIONS.RESERVATIONS.VIEW,
      },
      {
        labelKey: LABEL_KEYS.CLIENTS,
        // TODO: Change when this route is created
        route: "/admin/clients",
        icon: UserRound,
        requiredPermission: PERMISSIONS.CLIENTS.VIEW,
      },
    ],
  },
  {
    sectionKey: SECTION_KEYS.INVENTORY,
    items: [
      {
        labelKey: LABEL_KEYS.ROOMS,
        // TODO: Change when this route is created
        route: "/admin/rooms",
        icon: BedDouble,
        requiredPermission: PERMISSIONS.ROOMS.MANAGE,
      },
    ],
  },
  {
    sectionKey: SECTION_KEYS.FINANCE,
    items: [
      {
        labelKey: LABEL_KEYS.INVOICES,
        // TODO: Change when this route is created
        route: "/admin/invoices",
        icon: Receipt,
        requiredPermission: PERMISSIONS.INVOICES.VIEW,
      },
    ],
  },
  {
    sectionKey: SECTION_KEYS.CMS,
    items: [
      {
        labelKey: LABEL_KEYS.CMS_LANDING,
        route: ROUTES.ADMIN.CMS,
        icon: LayoutPanelTop,
        requiredPermission: PERMISSIONS.CMS.MANAGE,
      },
    ],
  },
];
