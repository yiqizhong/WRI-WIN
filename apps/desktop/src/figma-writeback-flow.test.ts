import { describe, expect, it } from "vitest";

import { summarizeWritebackResult } from "./figma-writeback-flow";

describe("summarizeWritebackResult", () => {
  it("explains skipped-only writeback", () => {
    const message = summarizeWritebackResult({
      sessionId: "sess-1",
      completedAt: new Date().toISOString(),
      results: [
        {
          changeId: "chg-1",
          sourceId: "1:11",
          status: "skipped",
          message: "No text change from original Figma copy"
        }
      ]
    });

    expect(message).toContain("No text change");
  });

  it("surfaces failed item messages", () => {
    const message = summarizeWritebackResult({
      sessionId: "sess-1",
      completedAt: new Date().toISOString(),
      results: [
        {
          changeId: "chg-1",
          sourceId: "1:11",
          status: "failed",
          message: "Figma write requires explicit user approval."
        }
      ]
    });

    expect(message).toBe("Writeback failed: Figma write requires explicit user approval.");
  });
});
