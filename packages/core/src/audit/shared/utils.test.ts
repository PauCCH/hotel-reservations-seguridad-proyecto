import { describe, expect, it } from "vitest";
import {
  buildAuditAction,
  formatAuditTimestamp,
  formatMetadataEntries,
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

describe("formatMetadataEntries", () => {
  it("returns no entries for empty or missing metadata", () => {
    expect(formatMetadataEntries({})).toEqual([]);
    expect(formatMetadataEntries(undefined as never)).toEqual([]);
  });

  it("returns plain key/value text pairs, stringifying primitives", () => {
    expect(formatMetadataEntries({ email: "a@b.com", page: 2, flag: false })).toEqual([
      { key: "email", value: "a@b.com" },
      { key: "page", value: "2" },
      { key: "flag", value: "false" },
    ]);
  });

  it("pretty-prints nested object values", () => {
    expect(formatMetadataEntries({ context: { requireAdmin: true } })).toEqual([
      { key: "context", value: JSON.stringify({ requireAdmin: true }, null, 2) },
    ]);
  });

  it("never escapes or alters markup: output is raw text for a text-node renderer", () => {
    const payload = "<img src=x onerror=alert(1)>";
    expect(formatMetadataEntries({ email: payload })).toEqual([{ key: "email", value: payload }]);
  });

  it("exposes no HTML-building helper", async () => {
    const mod = await import("./utils");
    expect("formatMetadataHtml" in mod).toBe(false);
  });
});
