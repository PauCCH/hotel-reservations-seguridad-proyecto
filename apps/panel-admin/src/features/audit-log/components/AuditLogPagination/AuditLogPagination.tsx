"use client";

import { Pagination } from "@heroui/react";
import { useI18n } from "@/locales";
import { getPageNumbers } from "../../utils/get-page-numbers";
import type { AuditLogPaginationProps } from "./AuditLogPagination.interface";
import { AUDIT_LOG_PAGINATION_STYLES } from "./AuditLogPagination.styles";

export function AuditLogPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: AuditLogPaginationProps) {
  const { t } = useI18n();
  const texts = t.AUDIT_LOG.PAGINATION;

  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  return (
    <Pagination className={AUDIT_LOG_PAGINATION_STYLES.wrapper}>
      <Pagination.Summary>
        {texts.SHOWING} {startItem}–{endItem} {texts.OF} {totalItems} {texts.ITEMS_LABEL}
      </Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled={page === 1} onPress={() => onPageChange(page - 1)}>
            <Pagination.PreviousIcon />
            <span>{texts.PREVIOUS}</span>
          </Pagination.Previous>
        </Pagination.Item>

        {getPageNumbers(page, totalPages).map((p, i, arr) =>
          p === "ellipsis" ? (
            <Pagination.Item key={`ellipsis-after-${arr[i - 1]}`}>
              <Pagination.Ellipsis />
            </Pagination.Item>
          ) : (
            <Pagination.Item key={p}>
              <Pagination.Link isActive={p === page} onPress={() => onPageChange(p)}>
                {p}
              </Pagination.Link>
            </Pagination.Item>
          ),
        )}

        <Pagination.Item>
          <Pagination.Next isDisabled={page === totalPages} onPress={() => onPageChange(page + 1)}>
            <span>{texts.NEXT}</span>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}
