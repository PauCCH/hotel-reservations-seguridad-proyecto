"use client";

import type { AuditLogEntry } from "@hotel/db/types";
import { useCallback, useState } from "react";

interface UseAuditLogDrawerReturn {
  selectedRow: AuditLogEntry | null;
  isOpen: boolean;
  openDrawer: (row: AuditLogEntry) => void;
  closeDrawer: () => void;
}

/**
 * Selected-row + open/close state for the audit log detail drawer.
 * Mirrors `usePermissionDrawer`'s open/close shape.
 */
export const useAuditLogDrawer = (): UseAuditLogDrawerReturn => {
  const [selectedRow, setSelectedRow] = useState<AuditLogEntry | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openDrawer = useCallback((row: AuditLogEntry) => {
    setSelectedRow(row);
    setIsOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
    setSelectedRow(null);
  }, []);

  return { selectedRow, isOpen, openDrawer, closeDrawer };
};
