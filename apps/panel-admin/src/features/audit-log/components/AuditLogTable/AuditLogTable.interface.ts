import type { AuditLogEntry } from "@hotel/db/types";

export interface AuditLogTableProps {
  rows: AuditLogEntry[];
  onRowSelect: (row: AuditLogEntry) => void;
}
