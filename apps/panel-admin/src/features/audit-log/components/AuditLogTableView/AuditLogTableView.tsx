"use client";

import { useI18n } from "@/locales";
import { PageHeader } from "@/shared/components/PageHeader";
import { useAuditLogDrawer } from "../../hooks/useAuditLogDrawer";
import { useAuditLogTable } from "../../hooks/useAuditLogTable";
import { AuditLogDetailDrawer } from "../AuditLogDetailDrawer/AuditLogDetailDrawer";
import { AuditLogFilters } from "../AuditLogFilters/AuditLogFilters";
import { AuditLogPagination } from "../AuditLogPagination/AuditLogPagination";
import { AuditLogTable } from "../AuditLogTable/AuditLogTable";
import type { AuditLogTableViewProps } from "./AuditLogTableView.interface";
import { AUDIT_LOG_PAGE_STYLES, CARD_STYLES } from "./AuditLogTableView.styles";

export const AuditLogTableView = ({ initialData }: AuditLogTableViewProps) => {
  const { t } = useI18n();

  const {
    rows,
    total,
    page,
    totalPages,
    pageSize,
    filters,
    isFiltered,
    setFilters,
    clearFilters,
    setPage,
  } = useAuditLogTable({ initialData });

  const { selectedRow, isOpen, openDrawer, closeDrawer } = useAuditLogDrawer();

  return (
    <main className={AUDIT_LOG_PAGE_STYLES.wrapper}>
      <PageHeader.Root>
        <PageHeader.Heading>
          <PageHeader.Title>
            {t.AUDIT_LOG.PAGE.TITLE_PREFIX}{" "}
            <PageHeader.TitleHighlight>{t.AUDIT_LOG.PAGE.TITLE_ACCENT}</PageHeader.TitleHighlight>
          </PageHeader.Title>
          <PageHeader.Description>
            {t.AUDIT_LOG.PAGE.DESCRIPTION}{" "}
            <PageHeader.DescriptionHighlight>{total}</PageHeader.DescriptionHighlight>
          </PageHeader.Description>
        </PageHeader.Heading>
      </PageHeader.Root>

      <div className={CARD_STYLES.bodySmall}>
        <AuditLogFilters
          filters={filters}
          onFiltersChange={setFilters}
          isFiltered={isFiltered}
          onClear={clearFilters}
        />
      </div>

      <AuditLogTable rows={rows} onRowSelect={openDrawer} />

      <AuditLogPagination
        page={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={setPage}
      />

      <AuditLogDetailDrawer isOpen={isOpen} onClose={closeDrawer} row={selectedRow} />
    </main>
  );
};
