"use client";

import { Button, ButtonGroup, Chip, EmptyState, Table } from "@heroui/react";
import { DB_ENUMS } from "@hotel/db";
import { Check, Inbox, Settings, X } from "lucide-react";
import { useI18n } from "@/locales";
import { PermissionGuard } from "@/shared/components/PermissionGuard/PermissionGuard";
import { APP_ROLES } from "@/shared/constants/roles";
import { useAdminActions } from "../../hooks/useAdminActions";
import type { AdminsTableProps } from "./AdminsTable.interface";
import { TABLE_STYLES } from "./AdminsTable.styles";

export const AdminsTable = ({
  admins,
  onToggle,
  togglingId,
  onManagePermissions,
}: AdminsTableProps) => {
  const { t } = useI18n();

  const TABLE_TEXTS = t.ADMINS.TABLE;

  const { handleToggle: onActionToggle, handleManagePermissions } = useAdminActions({
    onToggle,
    onManagePermissions,
  });

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label={TABLE_TEXTS.COL_NAME} className={TABLE_STYLES.content}>
          <Table.Header>
            <Table.Column isRowHeader>{TABLE_TEXTS.COL_NAME}</Table.Column>
            <Table.Column isRowHeader>{TABLE_TEXTS.COL_EMAIL}</Table.Column>
            <Table.Column>{TABLE_TEXTS.COL_STATUS}</Table.Column>
            <Table.Column>{TABLE_TEXTS.COL_ROLE}</Table.Column>
            {/* <Table.Column>Created At</Table.Column> */}
            <Table.Column>{TABLE_TEXTS.COL_ACTIONS}</Table.Column>
          </Table.Header>
          <Table.Body
            renderEmptyState={() => (
              <EmptyState className={TABLE_STYLES.emptyState}>
                <Inbox className={TABLE_STYLES.emptyStateIcon} />
                <span className={TABLE_STYLES.emptyStateText}>{TABLE_TEXTS.NO_RESULTS}</span>
              </EmptyState>
            )}
          >
            {admins?.map((user) => (
              <Table.Row key={user.id}>
                {/* VULNERABILIDAD INTRODUCIDA A PROPOSITO -- J2-POC-8 (Fase 2, Vector 2, XSS Stored, O11)
                    NO es codigo original del repo. React escapa JSX por defecto (`{user.full_name}`),
                    asi que no habia ningun sink inseguro real en este modulo (ver fase-2-pocs.md).
                    Esta linea reemplaza el render seguro original por dangerouslySetInnerHTML
                    unicamente para demostrar, de forma controlada, el patron de XSS stored que pide
                    el punto 2 del enunciado del proyecto. Se revierte en el PR de remediacion de
                    Fase 3 (ver docs/proyecto-seguridad/users/fase-2-pocs.md y fase-3-remediacion.md). */}
                <Table.Cell>
                  <span dangerouslySetInnerHTML={{ __html: user.full_name ?? "" }} />
                </Table.Cell>
                <Table.Cell>{user.email}</Table.Cell>
                <Table.Cell>
                  {user.is_active ? (
                    <Chip variant="primary" color="success">
                      {TABLE_TEXTS.STATUS_ACTIVE}
                    </Chip>
                  ) : (
                    <Chip variant="primary" color="danger">
                      {TABLE_TEXTS.STATUS_INACTIVE}
                    </Chip>
                  )}
                </Table.Cell>
                <Table.Cell>{user.role}</Table.Cell>
                {/* <Table.Cell>{user.created_at}</Table.Cell> */}
                <Table.Cell>
                  <ButtonGroup isDisabled={togglingId === user.id}>
                    {user.role !== APP_ROLES.OWNER && (
                      <>
                        <Button
                          variant="danger"
                          isIconOnly
                          isDisabled={!user.is_active}
                          onPress={() => onActionToggle(user.id, user.is_active)}
                        >
                          <X />
                        </Button>
                        <Button
                          variant="primary"
                          isIconOnly
                          isDisabled={user.is_active}
                          onPress={() => onActionToggle(user.id, user.is_active)}
                        >
                          <Check />
                        </Button>
                      </>
                    )}
                    <PermissionGuard permissions={[DB_ENUMS.user_permission.permissions_manage]}>
                      {user.role !== APP_ROLES.OWNER && (
                        <Button
                          variant="tertiary"
                          isIconOnly
                          onPress={() => handleManagePermissions(user)}
                        >
                          <Settings />
                        </Button>
                      )}
                    </PermissionGuard>
                  </ButtonGroup>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
};
