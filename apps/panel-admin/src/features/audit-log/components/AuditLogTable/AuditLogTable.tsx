"use client";

import { Button, EmptyState, Table } from "@heroui/react";
import { formatAuditTimestamp, truncateMetadata } from "@hotel/core/audit";
import { Inbox } from "lucide-react";
import { useI18n } from "@/locales";
import type { AuditLogTableProps } from "./AuditLogTable.interface";
import { AUDIT_LOG_TABLE_STYLES } from "./AuditLogTable.styles";

export const AuditLogTable = ({ rows, onRowSelect }: AuditLogTableProps) => {
  const { t } = useI18n();
  const TABLE_TEXTS = t.AUDIT_LOG.TABLE;

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content
          aria-label={TABLE_TEXTS.COL_ACTION}
          className={AUDIT_LOG_TABLE_STYLES.content}
        >
          <Table.Header>
            <Table.Column isRowHeader>{TABLE_TEXTS.COL_TIMESTAMP}</Table.Column>
            <Table.Column isRowHeader>{TABLE_TEXTS.COL_ACTION}</Table.Column>
            <Table.Column>{TABLE_TEXTS.COL_ACTOR}</Table.Column>
            <Table.Column>{TABLE_TEXTS.COL_ENTITY}</Table.Column>
            <Table.Column>{TABLE_TEXTS.COL_METADATA}</Table.Column>
          </Table.Header>
          <Table.Body
            renderEmptyState={() => (
              <EmptyState className={AUDIT_LOG_TABLE_STYLES.emptyState}>
                <Inbox className={AUDIT_LOG_TABLE_STYLES.emptyStateIcon} />
                <span className={AUDIT_LOG_TABLE_STYLES.emptyStateText}>
                  {TABLE_TEXTS.NO_RESULTS}
                </span>
              </EmptyState>
            )}
          >
            {rows.map((row) => (
              <Table.Row key={row.id}>
                <Table.Cell>{formatAuditTimestamp(row.created_at)}</Table.Cell>
                <Table.Cell>{row.action}</Table.Cell>
                <Table.Cell>{row.actor_email ?? "—"}</Table.Cell>
                <Table.Cell>{row.entity ?? "—"}</Table.Cell>
                <Table.Cell>
                  <Button
                    variant="tertiary"
                    size="sm"
                    className={AUDIT_LOG_TABLE_STYLES.metadataButton}
                    onPress={() => onRowSelect(row)}
                  >
                    {truncateMetadata(row.metadata)}
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
};
