import type { ThreeLayerGuidelineSnapshot } from "@writer/contracts";

import { buildGuidelinePromptSection, injectGuidelineContext } from "./guideline-injector";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FigmaAuditNode = {
  id: string;
  name: string;
  characters: string;
};

export type FigmaAuditResult = {
  id: string;
  /** The (possibly rewritten) text to use as the "after" copy. */
  suggestion: string;
  /** true = the LLM recommends a change; false = copy is already correct. */
  changed: boolean;
  /** 1-2 sentence explanation — why changed, or why it already conforms. */
  rationale: string;
};

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

const FIGMA_AUDIT_SYSTEM_PROMPT = `You are a senior UX copy auditor. Your job is to review Figma text layers against the provided writing guidelines and suggest improvements where needed.

You will receive a JSON array of text nodes from a Figma design file. For each node examine the copy, check it against every applicable writing rule, and decide whether a rewrite is needed.

Output ONLY valid JSON — no markdown fences, no preamble, no trailing commentary:
{"results":[{"id":"<node-id>","suggestion":"<text>","changed":<bool>,"rationale":"<1-2 sentences>"},...]}

Rules:
- Include ALL nodes in "results", even those that need no change.
- changed: false → copy already conforms; set "suggestion" to the original text verbatim.
- changed: true  → copy has an issue; provide an improved "suggestion".
- Keep suggestions concise and appropriate for software UI (labels, buttons, errors, tooltips, status lines).
- "rationale" must be 1-2 sentences. When recommending a change, cite the relevant rule or principle. When no change is needed, briefly explain why the copy already conforms.
- Preserve intent and terminology established by the background context.
- When writing rules conflict, prefer Product over Software Writing over Company Base.
- Do not flag very short icon labels or single-word UI primitives unless they clearly violate a terminology rule.`;

/**
 * Build the full prompt string to send to the LLM for a Figma audit.
 *
 * @param nodes  – extracted Figma text nodes (id, layer name, characters)
 * @param snapshot – resolved three-layer guideline snapshot for this session
 */
export function buildFigmaAuditPrompt(
  nodes: FigmaAuditNode[],
  snapshot: ThreeLayerGuidelineSnapshot
): string {
  // Combine all text for guideline context injection (glossary filtering etc.)
  const allText = nodes.map((n) => n.characters).join(" ");
  const ctx = injectGuidelineContext(snapshot, undefined, allText);
  const guidelineSection = buildGuidelinePromptSection(ctx);

  const nodeList = JSON.stringify(
    nodes.map((n) => ({ id: n.id, layer: n.name, text: n.characters })),
    null,
    2
  );

  const parts: string[] = [FIGMA_AUDIT_SYSTEM_PROMPT, "---"];

  if (guidelineSection.trim()) {
    parts.push(guidelineSection.trim());
    parts.push("---");
  }

  parts.push(`Text nodes to audit:\n${nodeList}`);
  parts.push(
    "Audit every node above. Return ONLY the JSON object with a \"results\" array — one entry per node."
  );

  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Result parsing
// ---------------------------------------------------------------------------

/**
 * Parse the raw LLM output string into structured audit results.
 * Tolerates markdown code fences and leading/trailing prose.
 */
export function parseFigmaAuditResults(rawText: string): FigmaAuditResult[] {
  let json = rawText.trim();

  // Strip optional markdown fences (```json … ```)
  const fenceMatch = json.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fenceMatch?.[1]) {
    json = fenceMatch[1].trim();
  }

  // Try to find a JSON object anywhere in the text
  if (!json.startsWith("{")) {
    const objectMatch = json.match(/(\{[\s\S]+\})/);
    if (objectMatch?.[1]) {
      json = objectMatch[1];
    }
  }

  try {
    const parsed = JSON.parse(json) as { results?: unknown[] };

    if (!Array.isArray(parsed.results)) {
      return [];
    }

    return parsed.results.flatMap((item): FigmaAuditResult[] => {
      if (!item || typeof item !== "object") return [];
      const r = item as Record<string, unknown>;
      if (typeof r.id !== "string" || typeof r.suggestion !== "string") return [];

      return [
        {
          id: r.id,
          suggestion: r.suggestion,
          changed: Boolean(r.changed),
          rationale: typeof r.rationale === "string" ? r.rationale : ""
        }
      ];
    });
  } catch {
    return [];
  }
}
