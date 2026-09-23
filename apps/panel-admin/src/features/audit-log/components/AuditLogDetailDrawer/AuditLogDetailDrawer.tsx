"use client";

import { Button, Drawer, useOverlayState } from "@heroui/react";
import { formatAuditTimestamp, formatMetadataHtml } from "@hotel/core/audit";
import { useI18n } from "@/locales";
import type { AuditLogDetailDrawerProps } from "./AuditLogDetailDrawer.interface";
import { AUDIT_LOG_DETAIL_DRAWER_STYLES } from "./AuditLogDetailDrawer.styles";

export function AuditLogDetailDrawer({ isOpen, onClose, row }: AuditLogDetailDrawerProps) {
  const { t } = useI18n();
  const TEXTS = t.AUDIT_LOG.DRAWER;

  const state = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });

  if (!row) return null;

  const metadataHtml = { __html: formatMetadataHtml(row.metadata) };

  return (
    <Drawer.Backdrop
      isOpen={state.isOpen}
      onOpenChange={state.setOpen}
      isDismissable={false}
      variant="blur"
    >
      <Drawer.Content placement="right">
        <Drawer.Dialog>
          <Drawer.Header>
            <Drawer.Heading>{TEXTS.TITLE}</Drawer.Heading>
          </Drawer.Header>

          <Drawer.Body>
            <div className={AUDIT_LOG_DETAIL_DRAWER_STYLES.fieldsWrapper}>
              <div className={AUDIT_LOG_DETAIL_DRAWER_STYLES.fieldWrapper}>
                <h3 className={AUDIT_LOG_DETAIL_DRAWER_STYLES.fieldLabel}>
                  {TEXTS.TIMESTAMP_LABEL}
                </h3>
                <p className={AUDIT_LOG_DETAIL_DRAWER_STYLES.fieldValue}>
                  {formatAuditTimestamp(row.created_at)}
                </p>
              </div>
              <div className={AUDIT_LOG_DETAIL_DRAWER_STYLES.fieldWrapper}>
                <h3 className={AUDIT_LOG_DETAIL_DRAWER_STYLES.fieldLabel}>{TEXTS.ACTOR_LABEL}</h3>
                <p className={AUDIT_LOG_DETAIL_DRAWER_STYLES.fieldValue}>
                  {row.actor_email ?? "—"}
                </p>
              </div>
              <div className={AUDIT_LOG_DETAIL_DRAWER_STYLES.fieldWrapper}>
                <h3 className={AUDIT_LOG_DETAIL_DRAWER_STYLES.fieldLabel}>{TEXTS.ACTION_LABEL}</h3>
                <p className={AUDIT_LOG_DETAIL_DRAWER_STYLES.fieldValue}>{row.action}</p>
              </div>
              <div className={AUDIT_LOG_DETAIL_DRAWER_STYLES.fieldWrapper}>
                <h3 className={AUDIT_LOG_DETAIL_DRAWER_STYLES.fieldLabel}>{TEXTS.ENTITY_LABEL}</h3>
                <p className={AUDIT_LOG_DETAIL_DRAWER_STYLES.fieldValue}>{row.entity ?? "—"}</p>
              </div>
              <div className={AUDIT_LOG_DETAIL_DRAWER_STYLES.fieldWrapper}>
                <h3 className={AUDIT_LOG_DETAIL_DRAWER_STYLES.metadataLabel}>
                  {TEXTS.METADATA_LABEL}
                </h3>
                <div
                  className={AUDIT_LOG_DETAIL_DRAWER_STYLES.metadataWrapper}
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: renders the pre-formatted metadata markup built by formatMetadataHtml
                  dangerouslySetInnerHTML={metadataHtml}
                />
              </div>
            </div>
          </Drawer.Body>

          <Drawer.Footer>
            <Button slot="close" variant="secondary" onPress={onClose}>
              {TEXTS.CLOSE}
            </Button>
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
