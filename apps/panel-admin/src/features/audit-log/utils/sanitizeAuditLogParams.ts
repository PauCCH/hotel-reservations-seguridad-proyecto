import { AUDIT_ACTIONS } from "@hotel/core/audit";
import {
  AUDIT_LOG_MAX_PAGE_SIZE,
  AUDIT_LOG_MAX_SEARCH_LENGTH,
  AUDIT_LOG_PAGE_SIZE,
} from "@/features/audit-log/constants/pagination";

const KNOWN_ACTIONS: ReadonlySet<string> = new Set(Object.values(AUDIT_ACTIONS));

// Allowlist for the free-text search term. Everything that has meaning inside a
// PostgREST `.or()` filter string (, ( ) " \ % :) or a LIKE pattern (%) is dropped.
const SEARCH_DISALLOWED_CHARS = /[^\p{L}\p{N}\s@._+-]/gu;

export const sanitizeSearch = (search: string | undefined): string | undefined => {
  if (!search) return undefined;
  const cleaned = search
    .replace(SEARCH_DISALLOWED_CHARS, "")
    .trim()
    .slice(0, AUDIT_LOG_MAX_SEARCH_LENGTH);
  return cleaned || undefined;
};

export const sanitizeAction = (action: string | undefined): string | undefined =>
  action && KNOWN_ACTIONS.has(action) ? action : undefined;

export const sanitizeDate = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) throw new Error("Invalid date filter");
  return new Date(timestamp).toISOString();
};

export const sanitizePage = (page: number | undefined): number =>
  Number.isSafeInteger(page) && (page as number) >= 1 ? (page as number) : 1;

export const sanitizePageSize = (pageSize: number | undefined): number => {
  if (!Number.isSafeInteger(pageSize) || (pageSize as number) < 1) return AUDIT_LOG_PAGE_SIZE;
  return Math.min(pageSize as number, AUDIT_LOG_MAX_PAGE_SIZE);
};
