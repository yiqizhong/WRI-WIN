import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseSpreadsheetFile } from "./parse";

describe("parseSpreadsheetFile", () => {
  it("parses csv with column role hints", async () => {
    const dir = await mkdtemp(join(tmpdir(), "writer-sheet-"));
    const filePath = join(dir, "copy.csv");
    await writeFile(
      filePath,
      "Source Copy,Suggested Copy,Status,Notes\nContinue,Continue to checkout,proposed,CTA clarity\n",
      "utf8"
    );

    const parsed = await parseSpreadsheetFile(filePath);

    expect(parsed.format).toBe("csv");
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.suggestedMapping.source).toBe(0);
    expect(parsed.suggestedMapping.suggestion).toBe(1);
  });
});
