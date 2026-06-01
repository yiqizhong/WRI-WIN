import {
  figmaGuidelineDraftSchema,
  figmaGuidelineGenerationRequestSchema,
  figmaGuidelineGenerationResponseSchema,
  parseFigmaReviewScope,
  semanticAnalysisSchema,
  type AgentRunEvent,
  type FigmaGuidelineDraft,
  type FigmaGuidelineGenerationResponse,
  type GuidelineCandidatePackage,
  type ReviewSession,
  type SemanticAnalysis
} from "@writer/contracts";
import {
  buildDeterministicGuidelineDraft,
  buildDeterministicSemanticAnalysis,
  buildGuidelineCandidatePackage,
  buildGuidelineGenerationSummary,
  buildGuidelineStarterPackSummary,
  extractFigmaTextNodesViaMcp,
  renderGuidelineStarterPack
} from "@writer/review-core";

import { startAgentRun } from "./agents";
import { createFigmaMcpCaller } from "./figma-mcp-caller";
import type { DaemonState } from "./state";

export async function generateFigmaGuideline(
  state: DaemonState,
  input: unknown
): Promise<FigmaGuidelineGenerationResponse> {
  const parsed = figmaGuidelineGenerationRequestSchema.parse(input);
  const session = requireSession(state, parsed.sessionId);

  if (session.sourceType !== "figma") {
    return failureResponse(parsed.sessionId, {
      code: "not_configured",
      severity: "warning",
      message: "Session is not a Figma review session.",
      recoveryAction: "Start a Figma session before generating guidelines."
    });
  }

  const scope = (session.scope ?? {}) as Record<string, unknown>;
  const figmaScope = parseFigmaReviewScope(scope.suggestedScope ?? scope);
  const extraction = await extractFigmaTextNodesViaMcp(figmaScope, createFigmaMcpCaller(state));

  if (!extraction.ok) {
    return failureResponse(parsed.sessionId, extraction.diagnostic);
  }

  const candidatePackage = buildGuidelineCandidatePackage(
    extraction.extraction.nodes.map((item) => ({
      id: item.id,
      characters: item.characters,
      path: item.path
    })),
    parsed.maxCandidates
  );

  if (candidatePackage.totalCandidates === 0) {
    return failureResponse(parsed.sessionId, {
      code: "tool_not_found",
      severity: "warning",
      message: "No usable text samples were found in the selected Figma scope.",
      recoveryAction: "Choose a frame or page that contains UI copy, then try again."
    });
  }

  const diagnostics: string[] = [];
  const llmAdapterId = parsed.adapterId ?? state.store.getActiveAdapterId() ?? undefined;
  let semanticAnalysis = buildDeterministicSemanticAnalysis(candidatePackage);

  if (llmAdapterId) {
    const llmSemantic = await trySemanticAnalysisByLlm(
      state,
      parsed.sessionId,
      llmAdapterId,
      candidatePackage
    );
    if (llmSemantic) {
      semanticAnalysis = llmSemantic;
    } else {
      semanticAnalysis = buildDeterministicSemanticAnalysis(candidatePackage, {
        stage: "semantic_analysis",
        reason: "llm_semantic_analysis_failed",
        limitations: ["Fell back to deterministic semantic clustering."]
      });
      diagnostics.push(`Semantic analysis fallback used (adapter: ${llmAdapterId}).`);
    }
  } else {
    semanticAnalysis = buildDeterministicSemanticAnalysis(candidatePackage, {
      stage: "semantic_analysis",
      reason: "no_adapter_available",
      limitations: ["No LLM adapter selected; deterministic semantic analysis used."]
    });
    diagnostics.push("No active adapter available; deterministic semantic analysis used.");
  }

  let draft: FigmaGuidelineDraft;
  let finalGenerationDegraded = false;
  if (llmAdapterId) {
    const llmDraft = await tryFinalGenerationByLlm(
      state,
      parsed.sessionId,
      llmAdapterId,
      candidatePackage,
      semanticAnalysis
    );
    if (llmDraft) {
      draft = llmDraft;
    } else {
      draft = buildDeterministicGuidelineDraft(candidatePackage, semanticAnalysis);
      finalGenerationDegraded = true;
      diagnostics.push("Final LLM generation failed; deterministic starter pack returned instead.");
    }
  } else {
    draft = buildDeterministicGuidelineDraft(candidatePackage, semanticAnalysis);
    diagnostics.push("No active adapter available; deterministic starter pack used.");
  }

  const generationSummary = buildGuidelineGenerationSummary(
    candidatePackage,
    semanticAnalysis,
    [
      ...(semanticAnalysis.degradedPath?.limitations ?? []),
      ...(finalGenerationDegraded
        ? ["Final LLM generation failed; output uses deterministic fallback."]
        : [])
    ]
  );

  const starterSummary = buildGuidelineStarterPackSummary({
    sourceLabel: session.featureName ?? `Session ${session.id}`,
    scopeLabel: figmaScope.kind === "frame" ? "Single frame" : "Figma scope",
    candidatePackage,
    semanticAnalysis,
    limitations: generationSummary.limitations
  });
  const files = renderGuidelineStarterPack({ draft, summary: starterSummary });

  return figmaGuidelineGenerationResponseSchema.parse({
    ok: true,
    sessionId: parsed.sessionId,
    candidatePackage,
    semanticAnalysis,
    generationSummary,
    files,
    diagnostics
  });
}

function failureResponse(
  sessionId: string,
  diagnostic: NonNullable<FigmaGuidelineGenerationResponse["diagnostic"]>,
  partial?: {
    candidatePackage?: GuidelineCandidatePackage;
    semanticAnalysis?: SemanticAnalysis;
    generationSummary?: FigmaGuidelineGenerationResponse["generationSummary"];
    diagnostics?: string[];
  }
): FigmaGuidelineGenerationResponse {
  return figmaGuidelineGenerationResponseSchema.parse({
    ok: false,
    sessionId,
    diagnostic,
    diagnostics: partial?.diagnostics ?? [diagnostic.message],
    candidatePackage: partial?.candidatePackage,
    semanticAnalysis: partial?.semanticAnalysis,
    generationSummary: partial?.generationSummary
  });
}

function requireSession(state: DaemonState, sessionId: string): ReviewSession {
  const sessions = state.store.listSessions(null);
  const session = sessions.sessions.find((item) => item.id === sessionId);
  if (!session) {
    throw new Error("Session not found");
  }
  return session;
}

async function trySemanticAnalysisByLlm(
  state: DaemonState,
  sessionId: string,
  adapterId: string,
  candidatePackage: GuidelineCandidatePackage
): Promise<SemanticAnalysis | null> {
  const prompt = [
    "You are extracting semantic analysis for UX writing evidence.",
    "Return STRICT JSON with keys:",
    "selectedSampleIds, duplicateGroups, terminology, observations, selectedEvidence, coverageGaps, confidenceNotes.",
    "observations items must include category, note, confidence (0-1).",
    "selectedEvidence items must include sampleId and reason.",
    "No markdown, no prose.",
    "",
    "Candidate package JSON:",
    JSON.stringify(candidatePackage)
  ].join("\n");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await startAgentRun(state, {
        sessionId,
        adapterId,
        prompt:
          attempt === 0
            ? prompt
            : `${prompt}\n\nPrevious output was invalid JSON. Return only valid JSON matching the schema.`
      });
      const raw = collectRunText(response.events);
      const json = tryExtractJson(raw);
      if (!json) continue;
      return semanticAnalysisSchema.parse({
        ...json,
        status: "applied"
      });
    } catch {
      // retry once
    }
  }

  return null;
}

async function tryFinalGenerationByLlm(
  state: DaemonState,
  sessionId: string,
  adapterId: string,
  candidatePackage: GuidelineCandidatePackage,
  semanticAnalysis: SemanticAnalysis
): Promise<FigmaGuidelineDraft | null> {
  const fallbackDraft = buildDeterministicGuidelineDraft(candidatePackage, semanticAnalysis);
  const prompt = [
    "You are generating a UX writing guideline starter pack from Figma UI copy evidence.",
    "Return STRICT JSON matching this shape:",
    JSON.stringify(fallbackDraft, null, 2),
    "",
    "Use semanticAnalysis.selectedEvidence and terminology to ground glossary and rules.",
    "No markdown wrapper, no prose outside JSON.",
    "",
    "Semantic analysis JSON:",
    JSON.stringify(semanticAnalysis),
    "",
    "Candidate package JSON:",
    JSON.stringify({
      coverageMetadata: candidatePackage.coverageMetadata,
      categoryDistribution: candidatePackage.categoryDistribution,
      samples: candidatePackage.samples.slice(0, 120)
    })
  ].join("\n");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await startAgentRun(state, {
        sessionId,
        adapterId,
        prompt:
          attempt === 0
            ? prompt
            : `${prompt}\n\nPrevious output was invalid. Return only valid JSON for the draft object.`
      });
      const raw = collectRunText(response.events);
      const json = tryExtractJson(raw);
      if (!json) continue;
      return figmaGuidelineDraftSchema.parse(json);
    } catch {
      // retry once
    }
  }

  return null;
}

function collectRunText(events: AgentRunEvent[]): string {
  return events
    .map((event) => {
      const payload = event.payload as Record<string, unknown>;
      const candidates = [payload.text, payload.content, payload.message];
      for (const value of candidates) {
        if (typeof value === "string" && value.trim().length > 0) {
          return value;
        }
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function tryExtractJson(input: string): Record<string, unknown> | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // continue
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}
