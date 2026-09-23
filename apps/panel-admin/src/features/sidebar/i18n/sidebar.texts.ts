import type { SupportedLocale } from "@hotel/i18n";
import type { SidebarTexts } from "./sidebar.type";

export const SIDEBAR_TEXTS: Record<SupportedLocale, SidebarTexts> = {
  es: {
    WRAPPER: {
      ARIA_LABEL: "Navegación principal",
    },
    HEADER: {
      LOGO: "Panel de administración",
      EXPAND: "Expandir barra lateral",
      COLLAPSE: "Colapsar barra lateral",
    },
    ROUTES_SECTIONS: {
      SECTIONS: {
        ADMINISTRATION: "Administracion",
        RESERVATIONS: "Reservas",
        INVENTORY: "Inventario",
        FINANCE: "Finanzas",
        CMS: "CMS",
      },
      ITEMS: {
        DASHBOARD: "Dashboard",
        ADMINS: "Administradores",
        METRICS_DASHBOARD: "Métricas",
        RESERVATIONS: "Reservas",
        CLIENTS: "Clientes",
        ROOMS: "Cuartos",
        INVOICES: "Facturas",
        CMS_LANDING: "Contenido Landing Page (CMS)",
        INVITATIONS: "Invitaciones",
        AUDIT_LOG: "Registro de Auditoría",
      },
    },
    FOOTER: {
      LOGOUT: "Cerrar sesión",
      LOGGING_OUT: "Cerrando sesión...",
    },
  },
  en: {
    WRAPPER: {
      ARIA_LABEL: "Main navigation",
    },
    HEADER: {
      LOGO: "Admin panel",
      EXPAND: "Expand sidebar",
      COLLAPSE: "Collapse sidebar",
    },
    ROUTES_SECTIONS: {
      SECTIONS: {
        ADMINISTRATION: "Administration",
        RESERVATIONS: "Reservations",
        INVENTORY: "Inventory",
        FINANCE: "Finance",
        CMS: "CMS",
      },
      ITEMS: {
        DASHBOARD: "Dashboard",
        ADMINS: "Admins",
        METRICS_DASHBOARD: "Metrics",
        RESERVATIONS: "Reservations",
        CLIENTS: "Clients",
        ROOMS: "Rooms",
        INVOICES: "Invoices",
        CMS_LANDING: "Landing page content (CMS)",
        INVITATIONS: "Invitations",
        AUDIT_LOG: "Audit Log",
      },
    },
    FOOTER: {
      LOGOUT: "Log out",
      LOGGING_OUT: "Logging out...",
    },
  },
} as const;
