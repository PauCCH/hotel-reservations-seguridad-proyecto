"use client";

import type { AuditLogEntry } from "@hotel/db/types";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AuditLogFiltersState } from "../components/AuditLogFilters/AuditLogFilters.interface";
import { AUDIT_LOG_PAGE_SIZE } from "../constants/pagination";
import type { GetAuditLogsParams, GetAuditLogsResult } from "../services/getAuditLogs";

const INITIAL_FILTERS: AuditLogFiltersState = { search: "", action: "", from: "", to: "" };

interface UseAuditLogTableOptions {
  initialData: GetAuditLogsResult;
}

interface UseAuditLogTableReturn {
  rows: AuditLogEntry[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  isLoading: boolean;
  error: string | null;
  filters: AuditLogFiltersState;
  isFiltered: boolean;
  setFilters: (filters: AuditLogFiltersState) => void;
  clearFilters: () => void;
  setPage: (page: number) => void;
}

/**
 * Fetch + filter/page state for the audit log table.
 *
 * Filtering and pagination are server-driven: every filter/page change
 * re-invokes the `getAuditLogs` Server Action.
 */
export const useAuditLogTable = ({
  initialData,
}: UseAuditLogTableOptions): UseAuditLogTableReturn => {
  const [rows, setRows] = useState<AuditLogEntry[]>(initialData.rows);
  const [total, setTotal] = useState(initialData.total);
  const [page, setPageState] = useState(initialData.page);
  const [filters, setFiltersState] = useState<AuditLogFiltersState>(INITIAL_FILTERS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFirstRender = useRef(true);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { getAuditLogs } = await import("../services/getAuditLogs");
      const params: GetAuditLogsParams = {
        page,
        pageSize: AUDIT_LOG_PAGE_SIZE,
        search: filters.search || undefined,
        action: filters.action || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      };
      const result = await getAuditLogs(params);
      setRows(result.rows);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchLogs();
  }, [fetchLogs]);

  const setFilters = useCallback((next: AuditLogFiltersState) => {
    setFiltersState(next);
    setPageState(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(INITIAL_FILTERS);
    setPageState(1);
  }, []);

  const setPage = useCallback((next: number) => {
    setPageState(next);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / AUDIT_LOG_PAGE_SIZE));
  const isFiltered =
    filters.search !== "" || filters.action !== "" || filters.from !== "" || filters.to !== "";

  return {
    rows,
    total,
    page,
    totalPages,
    pageSize: AUDIT_LOG_PAGE_SIZE,
    isLoading,
    error,
    filters,
    isFiltered,
    setFilters,
    clearFilters,
    setPage,
  };
};
