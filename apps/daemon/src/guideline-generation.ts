import {
  figmaGuidelineDraftSchema,
  figmaGuidelineGenerationAbandonRequestSchema,
  figmaGuidelineGenerationRequestSchema,
  figmaGuidelineGenerationResponseSchema,
  normalizeGuidelineCandidatePackage,
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
  buildCandidatePackageForBatch,
  chunkGuidelineCandidateSamples,
  extractFigmaTextNodesViaMcp,
  filterSemanticAnalysisToSampleIds,
  GUIDELINE_SEMANTIC_BATCH_SIZE,
  mergeSemanticAnalyses,
  renderGuidelineStarterPack
} from "@writer/review-core";

import { startAgentRun } from "./agents";
import { createFigmaMcpCaller } from "./figma-mcp-caller";
import type { DaemonState } from "./state";

/** Evidence summary sent to final Devin pass (full package stats, capped evidence list). */
const FINAL_PROMPT_EVIDENCE_LIMIT = 80;

export function compactCandidatePackageForLlmPrompt(
  candidatePackage: GuidelineCandidatePackage,
  sampleLimit = FINAL_PROMPT_EVIDENCE_LIMIT
): Record<string, unknown> {
  return {
    maxCandidates: candidatePackage.maxCandidates,
    totalCandidates: candidatePackage.totalCandidates,
    selectedCandidates: candidatePackage.selectedCandidates,
    categoryDistribution: candidatePackage.categoryDistribution,
    coverageMetadata: candidatePackage.coverageMetadata,
    samples: candidatePackage.samples.slice(0, sampleLimit),
    promptNote:
      sampleLimit < candidatePackage.samples.length
        ? `Including first ${sampleLimit} samples for grounding; semanticAnalysis.selectedEvidence lists the merged set.`
        : undefined
  };
}

export async function abandonFigmaGuidelineGeneration(
  state: DaemonState,
  input: unknown
): Promise<{ ok: true; sessionId: string }> {
  const parsed = figmaGuidelineGenerationAbandonRequestSchema.parse(input);
  const session = requireSession(state, parsed.sessionId);
  const scope = (session.scope ?? {}) as Record<string, unknown>;
  const existing = scope.guidelineGeneration as Record<string, unknown> | undefined;

  if (existing && typeof existing.completedAt === "string") {
    return { ok: true, sessionId: parsed.sessionId };
  }

  await persistGuidelineGenerationSession(
    state,
    session,
    failureResponse(parsed.sessionId, {
      code: "service_unavailable",
      severity: "error",
      message: parsed.message ?? "Guideline generation did not complete.",
      recoveryAction: "Return to Generate writing guidelines and start a new run."
    })
  );

  return { ok: true, sessionId: parsed.sessionId };
}

export async function generateFigmaGuideline(
  state: DaemonState,
  input: unknown
): Promise<FigmaGuidelineGenerationResponse> {
  const parsed = figmaGuidelineGenerationRequestSchema.parse(input);
  let session = requireSession(state, parsed.sessionId);
  session = await markGuidelineGenerationStarted(state, session);

  async function finish(response: FigmaGuidelineGenerationResponse): Promise<FigmaGuidelineGenerationResponse> {
    await persistGuidelineGenerationSession(state, session, response);
    return response;
  }

  if (session.sourceType !== "figma") {
    return finish(
      failureResponse(parsed.sessionId, {
      code: "not_configured",
      severity: "warning",
      message: "Session is not a Figma review session.",
      recoveryAction: "Start a Figma session before generating guidelines."
      })
    );
  }

  const scope = (session.scope ?? {}) as Record<string, unknown>;
  const figmaScope = parseFigmaReviewScope(scope.suggestedScope ?? scope);
  session = await updateGuidelineGenerationProgress(state, session, {
    stage: "extracting_figma",
    message: "Reading text from Figma…"
  });
  let lastProgressMs = 0;
  // Best-effort progress ticks: fire-and-forget, throttled to ~1/s.
  // `session` snapshot is intentionally stable here — only progressMessage changes
  // during extraction, and the returned session is picked up by the await below.
  const extraction = await extractFigmaTextNodesViaMcp(figmaScope, createFigmaMcpCaller(state), ({ stage, completed, total }) => {
    const now = Date.now();
    if (now - lastProgressMs >= 1000) {
      lastProgressMs = now;
      const message =
        stage === "metadata" ? "Reading text from Figma… fetching metadata" :
        stage === "scanning" ? "Reading text from Figma… scanning instances" :
        `Reading text from Figma… ${completed} / ${total}`;
      void updateGuidelineGenerationProgress(state, session, {
        stage: "extracting_figma",
        message
      });
    }
  });

  if (!extraction.ok) {
    return finish(failureResponse(parsed.sessionId, extraction.diagnostic));
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
    return finish(
      failureResponse(parsed.sessionId, {
        code: "tool_not_found",
        severity: "warning",
        message: "No usable text samples were found in the selected Figma scope.",
        recoveryAction: "Choose a frame or page that contains UI copy, then try again."
      })
    );
  }

  session = await updateGuidelineGenerationProgress(state, session, {
    stage: "building_candidates",
    message: `Prepared ${candidatePackage.selectedCandidates} copy samples.`
  });

  const diagnostics: string[] = (extraction.extraction.warnings ?? []).map((w) => w.message);
  const llmAdapterId = parsed.adapterId ?? state.store.getActiveAdapterId() ?? undefined;
  let semanticAnalysis = buildDeterministicSemanticAnalysis(candidatePackage);

  if (llmAdapterId) {
    session = await updateGuidelineGenerationProgress(state, session, {
      stage: "semantic_analysis",
      message: "Running semantic analysis…"
    });
    const batched = await trySemanticAnalysisBatched(
      state,
      session,
      llmAdapterId,
      candidatePackage
    );
    if (batched) {
      semanticAnalysis = batched.analysis;
      diagnostics.push(
        `Semantic analysis: ${batched.llmBatchCount}/${batched.batchCount} batches via Devin (${GUIDELINE_SEMANTIC_BATCH_SIZE} samples per batch).`
      );
      if (batched.deterministicBatchCount > 0) {
        diagnostics.push(
          `Semantic analysis fallback on ${batched.deterministicBatchCount} batch(es) after invalid Devin JSON.`
        );
      }
      if (batched.synthesized) {
        diagnostics.push("Merged batch results refined with a final Devin synthesis pass.");
      }
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

  session = await updateGuidelineGenerationProgress(state, session, {
    stage: "generating_files",
    message: "Drafting background, glossary, and writing guide…"
  });

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

  session = await updateGuidelineGenerationProgress(state, session, {
    stage: "rendering_files",
    message: "Rendering downloadable files…"
  });

  const starterSummary = buildGuidelineStarterPackSummary({
    sourceLabel: session.featureName ?? `Session ${session.id}`,
    scopeLabel: figmaScope.kind === "frame" ? "Single frame" : "Figma scope",
    candidatePackage,
    semanticAnalysis,
    limitations: generationSummary.limitations
  });
  const files = renderGuidelineStarterPack({ draft, summary: starterSummary });

  return finish(
    figmaGuidelineGenerationResponseSchema.parse({
      ok: true,
      sessionId: parsed.sessionId,
      candidatePackage: normalizeGuidelineCandidatePackage(candidatePackage),
      semanticAnalysis,
      generationSummary,
      files,
      diagnostics
    })
  );
}

type GuidelineProgressStage =
  | "extracting_figma"
  | "building_candidates"
  | "semantic_analysis"
  | "generating_files"
  | "rendering_files";

type GuidelineProgressUpdate = {
  stage: GuidelineProgressStage;
  message?: string;
  batchIndex?: number;
  batchTotal?: number;
};

async function markGuidelineGenerationStarted(
  state: DaemonState,
  session: ReviewSession
): Promise<ReviewSession> {
  return updateGuidelineGenerationProgress(state, session, {
    stage: "extracting_figma",
    message: "Starting guideline generation…"
  });
}

async function updateGuidelineGenerationProgress(
  state: DaemonState,
  session: ReviewSession,
  progress: GuidelineProgressUpdate
): Promise<ReviewSession> {
  const scope = { ...(session.scope ?? {}) } as Record<string, unknown>;
  const previous = (scope.guidelineGeneration ?? {}) as Record<string, unknown>;
  const guidelineGeneration: Record<string, unknown> = {
    ...previous,
    inFlight: true,
    startedAt: typeof previous.startedAt === "string" ? previous.startedAt : new Date().toISOString(),
    progressStage: progress.stage,
    progressMessage: progress.message,
    progressBatchIndex: progress.batchIndex,
    progressBatchTotal: progress.batchTotal
  };

  if (progress.message === undefined) {
    delete guidelineGeneration.progressMessage;
  }
  if (progress.batchIndex === undefined) {
    delete guidelineGeneration.progressBatchIndex;
  }
  if (progress.batchTotal === undefined) {
    delete guidelineGeneration.progressBatchTotal;
  }

  const updated: ReviewSession = {
    ...session,
    status: "running",
    scope: {
      ...scope,
      workflow: "figma_guideline_generation",
      guidelineGeneration
    },
    updatedAt: new Date().toISOString()
  };

  state.store.upsertSession(updated);
  await state.store.save();
  return updated;
}

async function persistGuidelineGenerationSession(
  state: DaemonState,
  session: ReviewSession,
  response: FigmaGuidelineGenerationResponse
): Promise<void> {
  const scope = { ...(session.scope ?? {}) } as Record<string, unknown>;
  const guidelineGeneration: Record<string, unknown> = {
    ok: response.ok,
    completedAt: new Date().toISOString(),
    fileNames: response.files?.map((file) => file.name)
  };

  if (response.ok && response.files) {
    guidelineGeneration.files = response.files.map((file) => ({
      name: file.name,
      mimeType: file.mimeType,
      content: file.content
    }));
  }

  state.store.upsertSession({
    ...session,
    status: response.ok ? "completed" : "canceled",
    diagnostic: response.ok ? session.diagnostic : (response.diagnostic ?? session.diagnostic),
    scope: {
      ...scope,
      workflow: "figma_guideline_generation",
      guidelineGeneration
    },
    updatedAt: new Date().toISOString()
  });

  await state.store.save();
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

type BatchedSemanticResult = {
  analysis: SemanticAnalysis;
  batchCount: number;
  llmBatchCount: number;
  deterministicBatchCount: number;
  synthesized: boolean;
};

async function trySemanticAnalysisBatched(
  state: DaemonState,
  session: ReviewSession,
  adapterId: string,
  candidatePackage: GuidelineCandidatePackage
): Promise<BatchedSemanticResult | null> {
  const sampleBatches = chunkGuidelineCandidateSamples(candidatePackage.samples);
  if (sampleBatches.length === 0) {
    return null;
  }

  const batchCount = sampleBatches.length;
  const parts: SemanticAnalysis[] = [];
  let llmBatchCount = 0;
  let deterministicBatchCount = 0;
  let activeSession = session;

  for (let batchIndex = 0; batchIndex < sampleBatches.length; batchIndex += 1) {
    activeSession = await updateGuidelineGenerationProgress(state, activeSession, {
      stage: "semantic_analysis",
      message: `Analyzing batch ${batchIndex + 1} of ${batchCount}…`,
      batchIndex: batchIndex + 1,
      batchTotal: batchCount
    });

    const batchSamples = sampleBatches[batchIndex]!;
    const batchPackage = buildCandidatePackageForBatch(
      candidatePackage,
      batchSamples,
      batchIndex,
      batchCount
    );
    const validSampleIds = new Set(batchSamples.map((sample) => sample.sampleId));

    let partial =
      (await trySemanticAnalysisBatchByLlm(
        state,
        activeSession.id,
        adapterId,
        candidatePackage,
        batchPackage,
        batchIndex,
        batchCount
      )) ??
      (await trySemanticAnalysisBatchByLlm(
        state,
        activeSession.id,
        adapterId,
        candidatePackage,
        batchPackage,
        batchIndex,
        batchCount,
        true
      ));

    if (partial) {
      llmBatchCount += 1;
      parts.push(filterSemanticAnalysisToSampleIds(partial, validSampleIds));
      continue;
    }

    deterministicBatchCount += 1;
    parts.push(
      buildDeterministicSemanticAnalysis(batchPackage, {
        stage: "semantic_analysis",
        reason: `batch_${batchIndex + 1}_llm_failed`,
        limitations: [`Batch ${batchIndex + 1}/${batchCount} used deterministic clustering.`]
      })
    );
  }

  let merged = mergeSemanticAnalyses({
    candidatePackage,
    parts,
    llmBatchCount,
    deterministicBatchCount,
    batchCount
  });

  let synthesized = false;
  if (batchCount > 1 && llmBatchCount > 0) {
    activeSession = await updateGuidelineGenerationProgress(state, activeSession, {
      stage: "semantic_analysis",
      message: "Synthesizing batch results…",
      batchIndex: batchCount,
      batchTotal: batchCount
    });
    const refined = await trySemanticSynthesisByLlm(
      state,
      activeSession.id,
      adapterId,
      candidatePackage,
      merged
    );
    if (refined) {
      merged = refined;
      synthesized = true;
    }
  }

  return {
    analysis: merged,
    batchCount,
    llmBatchCount,
    deterministicBatchCount,
    synthesized
  };
}

async function trySemanticAnalysisBatchByLlm(
  state: DaemonState,
  sessionId: string,
  adapterId: string,
  fullPackage: GuidelineCandidatePackage,
  batchPackage: ReturnType<typeof buildCandidatePackageForBatch>,
  batchIndex: number,
  batchCount: number,
  isRetry = false
): Promise<SemanticAnalysis | null> {
  const prompt = [
    "You are extracting semantic analysis for UX writing evidence from ONE batch of a larger Figma scan.",
    `This is batch ${batchIndex + 1} of ${batchCount} (${batchPackage.batchSampleCount} samples; ${fullPackage.totalCandidates} total across all batches).`,
    "Only reference sampleIds that appear in this batch's samples array.",
    "Return STRICT JSON with keys:",
    "selectedSampleIds, duplicateGroups, terminology, observations, selectedEvidence, coverageGaps, confidenceNotes.",
    "observations items must include category, note, confidence (0-1).",
    "selectedEvidence items must include sampleId and reason.",
    "No markdown, no prose.",
    isRetry ? "Previous output was invalid JSON. Return only valid JSON matching the schema." : "",
    "",
    "Batch candidate package JSON:",
    JSON.stringify(batchPackage)
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await startAgentRun(state, {
      sessionId,
      adapterId,
      prompt
    });
    const raw = collectRunText(response.events);
    const json = tryExtractJson(raw);
    if (!json) {
      return null;
    }
    return semanticAnalysisSchema.parse({
      ...json,
      status: "applied"
    });
  } catch {
    return null;
  }
}

async function trySemanticSynthesisByLlm(
  state: DaemonState,
  sessionId: string,
  adapterId: string,
  candidatePackage: GuidelineCandidatePackage,
  merged: SemanticAnalysis
): Promise<SemanticAnalysis | null> {
  const prompt = [
    "You are merging batched UX writing semantic analysis into one final analysis for a Figma guideline starter pack.",
    "Refine terminology (dedupe, rank by importance), merge duplicate observations, and keep the strongest selectedEvidence.",
    "Return STRICT JSON with the same keys as the input:",
    "selectedSampleIds, duplicateGroups, terminology, observations, selectedEvidence, coverageGaps, confidenceNotes.",
    "Only use sampleIds that exist in allowedSampleIds.",
    "No markdown, no prose.",
    "",
    "allowedSampleIds:",
    JSON.stringify(candidatePackage.samples.map((sample) => sample.sampleId)),
    "",
    "Merged batch analysis JSON:",
    JSON.stringify(merged),
    "",
    "Package coverage:",
    JSON.stringify({
      totalCandidates: candidatePackage.totalCandidates,
      categoryDistribution: candidatePackage.categoryDistribution,
      coverageMetadata: candidatePackage.coverageMetadata
    })
  ].join("\n");

  try {
    const response = await startAgentRun(state, {
      sessionId,
      adapterId,
      prompt
    });
    const raw = collectRunText(response.events);
    const json = tryExtractJson(raw);
    if (!json) {
      return null;
    }
    const validSampleIds = new Set(candidatePackage.samples.map((sample) => sample.sampleId));
    return filterSemanticAnalysisToSampleIds(
      semanticAnalysisSchema.parse({
        ...json,
        status: "applied"
      }),
      validSampleIds
    );
  } catch {
    return null;
  }
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
    JSON.stringify(compactCandidatePackageForLlmPrompt(candidatePackage))
  ].join("\n");

  try {
    const response = await startAgentRun(state, {
      sessionId,
      adapterId,
      prompt
    });
    const raw = collectRunText(response.events);
    const json = tryExtractJson(raw);
    if (!json) {
      return null;
    }
    return figmaGuidelineDraftSchema.parse(json);
  } catch {
    return null;
  }
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
