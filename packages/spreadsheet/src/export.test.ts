import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import type { ReviewChange } from "@writer/contracts";

import { exportSpreadsheetFile } from "./export";

describe("exportSpreadsheetFile", () => {
  it("writes approved suggestions into CSV export", async () => {
    const directory = await mkdtemp(join(tmpdir(), "writer-export-"));
    const outputPath = join(directory, "out.csv");

    const changes: ReviewChange[] = [
      {
        id: "chg-1",
        sessionId: "sess-1",
        sourceId: "row-1",
        status: "approved",
        before: "Click here",
        after: "Continue",
        rationale: "Clearer CTA",
        updatedAt: new Date().toISOString(),
        updatedBy: "user"
      }
    ];

    await exportSpreadsheetFile({
      parsed: {
        fileName: "strings.csv",
        format: "csv",
        columns: [
          { index: 0, header: "Key", role: "ignore", confidence: 0.5 },
          { index: 1, header: "Copy", role: "source", confidence: 0.9 },
          { index: 2, header: "Suggestion", role: "suggestion", confidence: 0.8 }
        ],
        rows: [
          {
            id: "row-1",
            index: 0,
            cells: { Key: "cta", Copy: "Click here", Suggestion: "" }
          }
        ],
        suggestedMapping: { source: 1, suggestion: 2 }
      },
      mapping: { source: 1, suggestion: 2 },
      changes,
      outputPath
    });

    const exported = await readFile(outputPath, "utf8");
    expect(exported).toContain("Continue");
    expect(exported).toContain("approved");
  });
});
