import { describe, expect, it, vi } from "vitest";

import {
  buildDeterministicSemanticAnalysis,
  buildGuidelineCandidatePackage
} from "@writer/review-core";

import {
  compactCandidatePackageForLlmPrompt,
  generateFigmaGuideline
} from "./guideline-generation";
import type { DaemonState } from "./state";

vi.mock("./agents", () => ({
  startAgentRun: vi.fn()
}));

vi.mock("./figma-mcp-caller", () => ({
  createFigmaMcpCaller: vi.fn(() => vi.fn())
}));

vi.mock("@writer/review-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@writer/review-core")>();
  return {
    ...actual,
    extractFigmaTextNodesViaMcp: vi.fn()
  };
});

import { startAgentRun } from "./agents";
import { extractFigmaTextNodesViaMcp } from "@writer/review-core";

function mockState(overrides?: Partial<DaemonState>): DaemonState {
  return {
    store: {
      listSessions: () => ({
        sessions: [
          {
            id: "sess-1",
            projectId: "proj-1",
            sourceType: "figma",
            scope: { kind: "frame", fileKey: "abc", nodeId: "1:2" },
            status: "draft",
            agentRunIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            featureName: "Checkout"
          }
        ]
      }),
      getActiveAdapterId: () => "devin"
    },
    ...overrides
  } as unknown as DaemonState;
}

describe("generateFigmaGuideline", () => {
  it("returns diagnostic when extraction fails", async () => {
    vi.mocked(extractFigmaTextNodesViaMcp).mockResolvedValue({
      ok: false,
      diagnostic: {
        code: "mcp_not_ready",
        severity: "warning",
        message: "Figma MCP is not connected.",
        recoveryAction: "Connect Figma in Agents."
      }
    });

    const result = await generateFigmaGuideline(mockState(), { sessionId: "sess-1" });
    expect(result.ok).toBe(false);
    expect(result.diagnostic?.code).toBe("mcp_not_ready");
    expect(result.files).toBeUndefined();
  });

  it("returns four files when semantic and final LLM fall back deterministically", async () => {
    vi.mocked(extractFigmaTextNodesViaMcp).mockResolvedValue({
      ok: true,
      extraction: {
        nodes: [
          { id: "1", characters: "Continue to checkout", path: ["Checkout", "Frame 1"] },
          { id: "2", characters: "Order summary", path: ["Summary", "Frame 2"] }
        ]
      }
    } as never);

    vi.mocked(startAgentRun).mockRejectedValue(new Error("offline"));

    const result = await generateFigmaGuideline(mockState(), { sessionId: "sess-1" });
    expect(result.ok).toBe(true);
    expect(result.files?.map((file) => file.name)).toEqual([
      "background.md",
      "glossary.csv",
      "writing-guide.md",
      "generation-summary.md"
    ]);
    expect(result.semanticAnalysis?.status).toBe("fallback");
    expect(result.diagnostics.some((item) => item.includes("fallback"))).toBe(true);
  });

  it("marks final generation degradation without returning partial files", async () => {
    vi.mocked(extractFigmaTextNodesViaMcp).mockResolvedValue({
      ok: true,
      extraction: {
        nodes: [{ id: "1", characters: "Continue to checkout", path: ["Checkout", "Frame 1"] }]
      }
    } as never);

    vi.mocked(startAgentRun)
      .mockResolvedValueOnce({
        events: [
          {
            type: "message",
            payload: {
              text: '{"selectedSampleIds":["sample-1"],"duplicateGroups":[],"terminology":[],"observations":[],"selectedEvidence":[],"coverageGaps":[],"confidenceNotes":[]}'
            }
          }
        ]
      } as never)
      .mockResolvedValueOnce({
        events: [{ type: "message", payload: { text: "not json" } }]
      } as never);

    const result = await generateFigmaGuideline(mockState(), { sessionId: "sess-1" });
    expect(result.ok).toBe(true);
    expect(result.files).toHaveLength(4);
    expect(result.diagnostics.some((item) => item.includes("Final LLM generation failed"))).toBe(true);
  });

  it("truncates candidate samples in LLM prompts", () => {
    const candidatePackage = buildGuidelineCandidatePackage(
      Array.from({ length: 90 }, (_, index) => ({
        id: String(index),
        characters: `Label ${index}`,
        path: ["Page", `Frame ${index}`]
      })),
      90
    );

    const compact = compactCandidatePackageForLlmPrompt(candidatePackage, 72);
    expect(compact.samples).toHaveLength(72);
    expect(compact.promptNote).toMatch(/first 72/);
  });

  it("runs semantic analysis in batches of 100 and merges before final generation", async () => {
    vi.mocked(extractFigmaTextNodesViaMcp).mockResolvedValue({
      ok: true,
      extraction: {
        nodes: Array.from({ length: 150 }, (_, index) => ({
          id: String(index),
          characters: `Button ${index}`,
          path: ["Page", `Frame ${index % 5}`]
        }))
      }
    } as never);

    const semanticJson =
      '{"selectedSampleIds":[],"duplicateGroups":[],"terminology":["Save"],"observations":[{"category":"cta","note":"Short labels","confidence":0.8}],"selectedEvidence":[],"coverageGaps":[],"confidenceNotes":[]}';

    const draftJson = JSON.stringify({
      background: "Background",
      glossary: [{ term: "Save", definition: "Primary action", examples: ["Save"] }],
      writingRules: [{ title: "Be concise", description: "Keep CTAs short.", examples: ["Save"] }],
      generationNotes: ["Batch test"]
    });

    let callCount = 0;
    vi.mocked(startAgentRun).mockImplementation(async () => {
      callCount += 1;
      if (callCount <= 2) {
        return {
          events: [{ type: "message", payload: { text: semanticJson } }]
        } as never;
      }
      if (callCount === 3) {
        return {
          events: [{ type: "message", payload: { text: semanticJson } }]
        } as never;
      }
      return {
        events: [{ type: "message", payload: { text: draftJson } }]
      } as never;
    });

    const result = await generateFigmaGuideline(mockState(), { sessionId: "sess-1" });
    expect(result.ok).toBe(true);
    expect(callCount).toBeGreaterThanOrEqual(4);
    expect(result.diagnostics?.some((item) => item.includes("2/2 batches"))).toBe(true);
    expect(
      result.diagnostics?.some((item) => item.includes("final Devin synthesis pass"))
    ).toBe(true);
  });

  it("never trusts malformed semantic analysis JSON", async () => {
    const candidatePackage = buildGuidelineCandidatePackage([
      { id: "1", characters: "Save changes", path: ["Checkout"] }
    ]);
    expect(() =>
      buildDeterministicSemanticAnalysis({
        ...candidatePackage,
        selectedCandidates: 1
      })
    ).not.toThrow();
  });
});
