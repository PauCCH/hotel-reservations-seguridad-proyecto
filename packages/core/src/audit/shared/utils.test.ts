import { describe, expect, it } from "vitest";
import {
  buildAuditAction,
  formatAuditTimestamp,
  formatMetadataHtml,
  truncateMetadata,
} from "./utils";

describe("buildAuditAction", () => {
  it("joins namespace, entity and outcome with dots", () => {
    expect(buildAuditAction("auth", "login", "success")).toBe("auth.login.success");
  });

  it("joins a different namespace/entity/outcome combination", () => {
    expect(buildAuditAction("audit", "log", "viewed")).toBe("audit.log.viewed");
  });
});

describe("truncateMetadata", () => {
  it("formats a short metadata object as key=value pairs", () => {
    expect(truncateMetadata({ page: 1, search: "abc" })).toBe("page=1, search=abc");
  });

  it("returns a placeholder for empty metadata", () => {
    expect(truncateMetadata({})).toBe("—");
  });

  it("truncates long metadata to maxLength with an ellipsis", () => {
    const result = truncateMetadata({ blob: "x".repeat(100) }, 20);
    expect(result).toHaveLength(21);
    expect(result.endsWith("…")).toBe(true);
    expect(result.startsWith("blob=xxxx")).toBe(true);
  });
});

describe("formatAuditTimestamp", () => {
  it("formats a valid ISO timestamp using UTC", () => {
    const result = formatAuditTimestamp("2026-01-15T10:30:00.000Z");
    expect(result).toBe("Jan 15, 2026, 10:30 AM");
  });

  it("formats a different valid ISO timestamp", () => {
    const result = formatAuditTimestamp("2026-06-01T23:05:00.000Z");
    expect(result).toBe("Jun 1, 2026, 11:05 PM");
  });

  it("returns a dash for an empty string", () => {
    expect(formatAuditTimestamp("")).toBe("—");
  });

  it("returns a dash for an invalid timestamp", () => {
    expect(formatAuditTimestamp("not-a-date")).toBe("—");
  });
});

describe("formatMetadataHtml", () => {
  it("returns an empty-state marker for empty metadata", () => {
    expect(formatMetadataHtml({})).toBe('<p class="audit-meta-empty">—</p>');
  });

  it("renders one audit-meta-row div per entry with bold keys", () => {
    const result = formatMetadataHtml({ email: "a@b.com", page: 2 });
    expect(result).toBe(
      '<div class="audit-meta-row"><strong>email</strong><span class="audit-meta-value">a@b.com</span></div>' +
        '<div class="audit-meta-row"><strong>page</strong><span class="audit-meta-value">2</span></div>',
    );
  });

  it("pretty-prints nested object values", () => {
    const result = formatMetadataHtml({ context: { requireAdmin: true } });
    const expectedRendered = JSON.stringify({ requireAdmin: true }, null, 2);
    expect(result).toBe(
      `<div class="audit-meta-row"><strong>context</strong><span class="audit-meta-value">${expectedRendered}</span></div>`,
    );
  });
});
