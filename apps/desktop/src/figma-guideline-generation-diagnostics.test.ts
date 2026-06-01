import { describe, expect, it } from "vitest";

import {
  guidelineGenerationAlertKind,
  guidelineGenerationUiState
} from "./figma-guideline-generation-diagnostics";

describe("figma guideline generation diagnostics", () => {
  it("shows warning for degraded-but-successful generation", () => {
    const state = guidelineGenerationUiState(
      {
        ok: true,
        sessionId: "sess-1",
        diagnostics: ["Semantic analysis fallback used (adapter: devin)."],
        files: [
          { name: "background.md", mimeType: "text/markdown", content: "# bg" },
          { name: "glossary.csv", mimeType: "text/csv", content: "term,definition,preferred,avoid,usage_context,example\n" },
          { name: "writing-guide.md", mimeType: "text/markdown", content: "# guide" },
          { name: "generation-summary.md", mimeType: "text/markdown", content: "# summary" }
        ]
      },
      false
    );

    expect(state.kind).toBe("degraded");
    expect(guidelineGenerationAlertKind(state)).toBe("warning");
  });

  it("shows error for hard failures", () => {
    const state = guidelineGenerationUiState(
      {
        ok: false,
        sessionId: "sess-1",
        diagnostics: [],
        diagnostic: {
          code: "mcp_not_ready",
          severity: "warning",
          message: "Figma MCP is not connected.",
          recoveryAction: "Connect Figma in Agents."
        }
      },
      false
    );

    expect(state.kind).toBe("failed");
    expect(guidelineGenerationAlertKind(state)).toBe("error");
  });
});
