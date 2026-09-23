import {
  AUDIT_LOG_PAGINATION_ELLIPSIS_THRESHOLD,
  AUDIT_LOG_PAGINATION_MAX_VISIBLE_PAGES,
  AUDIT_LOG_PAGINATION_NEIGHBOR_WINDOW,
} from "../constants/pagination";

export function getPageNumbers(page: number, totalPages: number): (number | "ellipsis")[] {
  const pages: (number | "ellipsis")[] = [];

  if (totalPages <= AUDIT_LOG_PAGINATION_MAX_VISIBLE_PAGES) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }

  pages.push(1);
  if (page > AUDIT_LOG_PAGINATION_ELLIPSIS_THRESHOLD) pages.push("ellipsis");

  const start = Math.max(2, page - AUDIT_LOG_PAGINATION_NEIGHBOR_WINDOW);
  const end = Math.min(totalPages - 1, page + AUDIT_LOG_PAGINATION_NEIGHBOR_WINDOW);
  for (let i = start; i <= end; i++) pages.push(i);

  if (page < totalPages - (AUDIT_LOG_PAGINATION_NEIGHBOR_WINDOW + 1)) pages.push("ellipsis");
  pages.push(totalPages);

  return pages;
}
