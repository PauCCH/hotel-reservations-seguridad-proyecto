export interface AuditLogFiltersState {
  search: string;
  action: string;
  from: string;
  to: string;
}

export interface AuditLogFiltersProps {
  filters: AuditLogFiltersState;
  onFiltersChange: (filters: AuditLogFiltersState) => void;
  isFiltered: boolean;
  onClear: () => void;
}
