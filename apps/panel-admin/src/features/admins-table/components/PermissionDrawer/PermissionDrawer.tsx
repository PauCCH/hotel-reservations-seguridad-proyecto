"use client";

import { Button, Drawer, useOverlayState } from "@heroui/react";
import { useI18n } from "@/locales";
import { PERMISSION_CATEGORIES } from "../../constants/permissionCategories";
import { usePermissionDrawer } from "../../hooks/usePermissionDrawer";
import type { PermissionDrawerProps } from "./PermissionDrawer.interface";
import { PERMISSION_DRAWER_STYLES } from "./PermissionDrawer.styles";

export function PermissionDrawer({ isOpen, onClose, admin, onSuccess }: PermissionDrawerProps) {
  const { t } = useI18n();
  const TEXTS = t.ADMINS.PERMISSIONS;

  const { selectedPermissions, isSaving, error, isLoading, handleTogglePermission, handleSave } =
    usePermissionDrawer({
      admin,
      onSuccess,
      onClose,
    });

  const state = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });

  if (!admin) return null;

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
            <Drawer.Heading>
              {/* VULNERABILIDAD INTRODUCIDA A PROPOSITO -- J2-POC-8 (Fase 2, Vector 2, XSS Stored, O11)
                  Igual que en AdminsTable.tsx: esto NO es codigo original, reemplaza el JSX seguro
                  original (`{admin.full_name ?? admin.email}`) por dangerouslySetInnerHTML solo para
                  la PoC. Se revierte en el PR de remediacion de Fase 3. */}
              {TEXTS.TITLE} -{" "}
              {admin.full_name ? (
                <span dangerouslySetInnerHTML={{ __html: admin.full_name }} />
              ) : (
                admin.email
              )}
            </Drawer.Heading>
          </Drawer.Header>

          <Drawer.Body>
            {error && (
              <div className={PERMISSION_DRAWER_STYLES.errorAlert}>{TEXTS.ERRORS[error]}</div>
            )}

            {isLoading && (
              <div className={PERMISSION_DRAWER_STYLES.loadingAlert}>{t.COMMON.STATUS.LOADING}</div>
            )}

            <div className={PERMISSION_DRAWER_STYLES.categoriesWrapper}>
              {PERMISSION_CATEGORIES.map((category) => (
                <div key={category.labelKey} className={PERMISSION_DRAWER_STYLES.categoryWrapper}>
                  <h3 className={PERMISSION_DRAWER_STYLES.categoryLabel}>
                    {TEXTS.CATEGORIES[category.labelKey] ?? category.labelKey}
                  </h3>
                  <div className={PERMISSION_DRAWER_STYLES.permissionsList}>
                    {category.permissions.map((permission) => (
                      <label key={permission} className={PERMISSION_DRAWER_STYLES.permissionLabel}>
                        <input
                          type="checkbox"
                          checked={selectedPermissions.has(permission)}
                          onChange={() => handleTogglePermission(permission)}
                          className={PERMISSION_DRAWER_STYLES.checkbox}
                        />
                        <span className={PERMISSION_DRAWER_STYLES.permissionText}>
                          {TEXTS.PERMISSION_LABELS[permission] ?? permission}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Drawer.Body>

          <Drawer.Footer>
            <Button slot="close" variant="secondary" onPress={onClose}>
              {t.COMMON.ACTIONS.CANCEL}
            </Button>
            <Button variant="primary" onPress={handleSave} isDisabled={isSaving || isLoading}>
              {isSaving ? t.COMMON.ACTIONS.SAVING : t.COMMON.ACTIONS.SAVE}
            </Button>
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
