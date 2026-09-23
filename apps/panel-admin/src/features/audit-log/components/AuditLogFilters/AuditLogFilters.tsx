"use client";

import { Button, Label, SearchField } from "@heroui/react";
import { AUDIT_ACTIONS } from "@hotel/core/audit";
import { useI18n } from "@/locales";
import type { AuditLogFiltersProps } from "./AuditLogFilters.interface";
import { AUDIT_LOG_FILTERS_STYLES as STYLES } from "./AuditLogFilters.styles";

export const AuditLogFilters = ({
  filters,
  onFiltersChange,
  isFiltered,
  onClear,
}: AuditLogFiltersProps) => {
  const { t } = useI18n();
  const texts = t.AUDIT_LOG.FILTERS;

  return (
    <div className={STYLES.wrapper}>
      <div className={STYLES.bar}>
        <div className={STYLES.searchWrapper}>
          <SearchField
            value={filters.search}
            onChange={(search) => onFiltersChange({ ...filters, search })}
            aria-label={texts.SEARCH_ARIA_LABEL}
          >
            <Label className="sr-only">{texts.SEARCH_ARIA_LABEL}</Label>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={texts.SEARCH_PLACEHOLDER} />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </div>

        <div className={STYLES.fieldWrapper}>
          <span className={STYLES.fieldLabel}>{texts.ACTION_LABEL}</span>
          <select
            className={STYLES.selectInput}
            value={filters.action}
            onChange={(e) => onFiltersChange({ ...filters, action: e.target.value })}
          >
            <option value="">{texts.ACTION_ALL}</option>
            {Object.values(AUDIT_ACTIONS).map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>

        <div className={STYLES.fieldWrapper}>
          <span className={STYLES.fieldLabel}>{texts.FROM_LABEL}</span>
          <input
            type="date"
            className={STYLES.dateInput}
            value={filters.from}
            onChange={(e) => onFiltersChange({ ...filters, from: e.target.value })}
          />
        </div>

        <div className={STYLES.fieldWrapper}>
          <span className={STYLES.fieldLabel}>{texts.TO_LABEL}</span>
          <input
            type="date"
            className={STYLES.dateInput}
            value={filters.to}
            onChange={(e) => onFiltersChange({ ...filters, to: e.target.value })}
          />
        </div>

        <div className={STYLES.spacer} />

        <div className={STYLES.rightSection}>
          <Button variant="ghost" size="sm" isDisabled={!isFiltered} onPress={onClear}>
            {texts.CLEAR}
          </Button>
        </div>
      </div>
    </div>
  );
};
