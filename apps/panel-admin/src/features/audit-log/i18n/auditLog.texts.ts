import type { SupportedLocale } from "@hotel/i18n";
import type { AuditLogTexts } from "./auditLogTexts.type";

export const AUDIT_LOG_TEXTS: Record<SupportedLocale, AuditLogTexts> = {
  es: {
    PAGE: {
      TITLE_PREFIX: "Registro de",
      TITLE_ACCENT: "Auditoría",
      DESCRIPTION: "Historial de eventos del sistema:",
    },
    TABLE: {
      COL_TIMESTAMP: "Fecha",
      COL_ACTION: "Acción",
      COL_ACTOR: "Actor",
      COL_ENTITY: "Entidad",
      COL_METADATA: "Detalles",
      NO_RESULTS: "No se encontraron eventos",
    },
    FILTERS: {
      SEARCH_PLACEHOLDER: "Buscar por acción o email...",
      SEARCH_ARIA_LABEL: "Buscar en el registro de auditoría",
      ACTION_LABEL: "Acción",
      ACTION_ALL: "Todas",
      FROM_LABEL: "Desde",
      TO_LABEL: "Hasta",
      CLEAR: "Limpiar filtros",
    },
    PAGINATION: {
      SHOWING: "Mostrando",
      OF: "de",
      ITEMS_LABEL: "eventos",
      PREVIOUS: "Anterior",
      NEXT: "Siguiente",
    },
    DRAWER: {
      TITLE: "Detalle del evento",
      ACTOR_LABEL: "Actor",
      ACTION_LABEL: "Acción",
      ENTITY_LABEL: "Entidad",
      TIMESTAMP_LABEL: "Fecha",
      METADATA_LABEL: "Metadatos",
      CLOSE: "Cerrar",
    },
  },
  en: {
    PAGE: {
      TITLE_PREFIX: "Audit",
      TITLE_ACCENT: "Log",
      DESCRIPTION: "History of system events:",
    },
    TABLE: {
      COL_TIMESTAMP: "Timestamp",
      COL_ACTION: "Action",
      COL_ACTOR: "Actor",
      COL_ENTITY: "Entity",
      COL_METADATA: "Details",
      NO_RESULTS: "No events found",
    },
    FILTERS: {
      SEARCH_PLACEHOLDER: "Search by action or email...",
      SEARCH_ARIA_LABEL: "Search the audit log",
      ACTION_LABEL: "Action",
      ACTION_ALL: "All",
      FROM_LABEL: "From",
      TO_LABEL: "To",
      CLEAR: "Clear filters",
    },
    PAGINATION: {
      SHOWING: "Showing",
      OF: "of",
      ITEMS_LABEL: "events",
      PREVIOUS: "Previous",
      NEXT: "Next",
    },
    DRAWER: {
      TITLE: "Event detail",
      ACTOR_LABEL: "Actor",
      ACTION_LABEL: "Action",
      ENTITY_LABEL: "Entity",
      TIMESTAMP_LABEL: "Timestamp",
      METADATA_LABEL: "Metadata",
      CLOSE: "Close",
    },
  },
} as const;
