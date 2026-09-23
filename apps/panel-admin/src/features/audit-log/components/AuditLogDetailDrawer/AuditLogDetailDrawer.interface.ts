import type { AuditLogEntry } from "@hotel/db/types";

export interface AuditLogDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  row: AuditLogEntry | null;
}
