import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(join(__dirname, relative), "utf8");

// A "use server" file turns every export into a public, unauthenticated HTTP
// endpoint (Next.js Server Action). The audit writer must stay a plain
// server-side module so only trusted server code can call it.
describe("audit server boundary", () => {
  it.each([
    "logAuditEvent.ts",
    "getAuditRequestContext.ts",
  ])("%s is not a Server Action module", (file) => {
    expect(read(file)).not.toMatch(/^\s*["']use server["']/m);
  });

  it("the client-safe entry point does not re-export the server writer", () => {
    const index = read("../index.ts");
    expect(index).not.toMatch(/^export[^;]*\b(logAuditEvent|getAuditRequestContext)\b/m);
    expect(index).not.toMatch(/^export[^;]*from\s+["']\.\/server\//m);
  });

  it("the server entry point exports the writer and the request-context reader", () => {
    const serverIndex = read("./index.ts");
    expect(serverIndex).toMatch(/^export[^;]*\blogAuditEvent\b/m);
    expect(serverIndex).toMatch(/^export[^;]*\bgetAuditRequestContext\b/m);
  });
});
