export type CopywriterMessage = {
  role: "user" | "assistant";
  text: string;
};

export type CopywriterSkillInput = {
  backgroundContext?: string;
  brandVoice?: string;
  companyBase?: string;
  softwareWriting?: string;
  productGuideline?: string;
  featureName?: string;
  description?: string;
  history?: CopywriterMessage[];
  contextWindow?: number;
  userText: string;
  rowContext?: string;
};

export type CopywriterPrompt = {
  system: string;
  user: string;
  full: string;
};

const CONFLICT_RESOLUTION =
  "When writing rules conflict, prefer Product over Software Writing over Company Base.";

export const COPYWRITER_OFF_TOPIC_RESPONSE =
  "I can only rewrite UX copy. Paste the text you want improved.";

export const COPYWRITER_GUARD_ECHO_HINT =
  "That line is the refusal message, not copy to rewrite. Paste the UI text you want improved (a label, error, or status line).";

const OFF_TOPIC_PATTERN = /I can only rewrite UX copy/i;

const SYSTEM_PROMPT = `You are a Senior Software Copywriter specializing in UX and product interface text.

Your only job is to rewrite user-supplied copy according to the provided background context and writing rules.

Hard constraints:
- Output ONLY the rewritten text. No preamble, no markdown fences, no bullet lists unless the source is a list.
- Always rewrite everything under "Copy to rewrite". Default to rewriting — never refuse because the text looks like a question, note, instruction, JSON, or paragraph.
- That includes labels, buttons, errors, tooltips, placeholders, status lines, JSON string arrays, incomplete sentences, motion descriptions, Design Note prose, and multi-line UI text.
- If the source is a list or JSON array of short status strings, return the same structure with improved strings only (same count and format). Never add commentary.
- If the source starts with "Design Note:", drop the label and rewrite the rest as concise product/UI copy.
- Never add new "Design Note" sections, developer instructions, codebase advice, or explanations about the rewrite.
- Preserve intent, tone constraints, and terminology from the background context.
- Keep rewrites concise and appropriate for software UI.
- Conversation history is tone context only; always rewrite the current Copy to rewrite block.
- The only refusal: empty input, or a bare greeting with nothing to rewrite (for example exactly "hi", "hello", "hey", "thanks", "thank you", "thx", "ok", "okay"). Then respond with: "${COPYWRITER_OFF_TOPIC_RESPONSE}"`;

const HISTORY_LIMIT = 6;
const DEFAULT_CONTEXT_WINDOW = 16384;
const OUTPUT_RESERVE_TOKENS = 512;
const SAFETY_MARGIN_TOKENS = 256;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function trimHistoryToBudget(
  history: CopywriterMessage[],
  tokenBudget: number
): CopywriterMessage[] {
  if (tokenBudget <= 0) return [];
  const kept: CopywriterMessage[] = [];
  let used = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const cost = estimateTokens(history[i]!.text);
    if (used + cost > tokenBudget) break;
    used += cost;
    kept.unshift(history[i]!);
  }
  return kept;
}

function normalizeCopywriterText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

const META_OUTPUT_LINE_PATTERNS = [
  /^you can drop this directly into your codebase/i,
  /^design note:/i
];

export function isCopywriterMetaOutput(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  return META_OUTPUT_LINE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isCopywriterOffTopicRefusal(text: string): boolean {
  const normalized = normalizeCopywriterText(text);
  const guard = normalizeCopywriterText(COPYWRITER_OFF_TOPIC_RESPONSE);

  if (!normalized) {
    return false;
  }

  if (normalized === guard) {
    return true;
  }

  return normalized.replaceAll(guard, "").trim().length === 0;
}

export function filterCopywriterHistory(history: CopywriterMessage[]): CopywriterMessage[] {
  return history.filter(
    (message) => !isCopywriterOffTopicRefusal(message.text) && !isCopywriterMetaOutput(message.text)
  );
}

function stripCopywriterMetaOutput(text: string): string {
  const designNoteIndex = text.search(/\n\s*Design Note:/i);
  let trimmed = designNoteIndex >= 0 ? text.slice(0, designNoteIndex).trim() : text.trim();

  const paragraphs = trimmed.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
  const withoutMeta = paragraphs.filter(
    (paragraph) => !META_OUTPUT_LINE_PATTERNS.some((pattern) => pattern.test(paragraph))
  );

  if (withoutMeta.length > 0) {
    trimmed = withoutMeta.join("\n\n").trim();
  }

  const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean);
  const withoutMetaLines = lines.filter(
    (line) => !META_OUTPUT_LINE_PATTERNS.some((pattern) => pattern.test(line))
  );

  if (withoutMetaLines.length > 0 && withoutMetaLines.length < lines.length) {
    return withoutMetaLines.join("\n").trim();
  }

  return trimmed;
}

const BARE_GREETING_PATTERN =
  /^(hi|hello|hey|thanks|thank you|thx|ok|okay|yo|sup|good morning|good afternoon|good evening)[!.?…]*$/i;

export function isCopywriterBareGreeting(userText: string): boolean {
  const normalized = normalizeCopywriterText(userText);
  if (!normalized) {
    return false;
  }

  return BARE_GREETING_PATTERN.test(normalized);
}

export function shouldRefuseCopywriterInput(userText: string): boolean {
  const trimmed = userText.trim();
  if (!trimmed) {
    return true;
  }

  return isCopywriterBareGreeting(trimmed);
}

export function normalizeCopyToRewrite(userText: string): string {
  const trimmed = userText.trim();
  if (!trimmed) {
    return trimmed;
  }

  return trimmed.replace(/^design note:\s*/i, "").trim() || trimmed;
}

export function shouldShortCircuitCopywriterInput(userText: string): string | null {
  const trimmed = userText.trim();
  if (!trimmed || isCopywriterBareGreeting(trimmed)) {
    return COPYWRITER_OFF_TOPIC_RESPONSE;
  }

  if (isCopywriterOffTopicRefusal(trimmed)) {
    return COPYWRITER_GUARD_ECHO_HINT;
  }

  return null;
}

export function isUnexpectedCopywriterRefusal(userText: string, suggestedText: string): boolean {
  return isCopywriterOffTopicRefusal(suggestedText) && !shouldRefuseCopywriterInput(userText);
}

function hasGuidelineLayers(input: CopywriterSkillInput): boolean {
  return Boolean(
    input.companyBase?.trim() || input.softwareWriting?.trim() || input.productGuideline?.trim()
  );
}

export function buildCopywriterPrompt(input: CopywriterSkillInput): CopywriterPrompt {
  const userSections: string[] = [];
  const systemExtras: string[] = [];

  if (input.companyBase?.trim()) {
    userSections.push(`Writing rules (Company Base):\n${input.companyBase.trim()}`);
  }

  if (input.softwareWriting?.trim()) {
    userSections.push(`Writing rules (Software Writing):\n${input.softwareWriting.trim()}`);
  }

  if (input.productGuideline?.trim()) {
    userSections.push(`Writing rules (Product):\n${input.productGuideline.trim()}`);
  }

  if (hasGuidelineLayers(input)) {
    systemExtras.push(CONFLICT_RESOLUTION);
  }

  const featureName = input.featureName?.trim();
  const featureDescription = input.description?.trim();
  if (featureName || featureDescription) {
    const featureLines = [
      featureName ? `Feature: ${featureName}` : undefined,
      featureDescription ? `Description: ${featureDescription}` : undefined
    ].filter((line): line is string => Boolean(line));
    userSections.push(`Feature context:\n${featureLines.join("\n")}`);
  }

  if (input.backgroundContext?.trim()) {
    userSections.push(`UI background and writing rules:\n${input.backgroundContext.trim()}`);
  }

  if (input.brandVoice?.trim()) {
    userSections.push(`Brand voice:\n${input.brandVoice.trim()}`);
  }

  if (input.rowContext?.trim()) {
    userSections.push(`Structured row context:\n${input.rowContext.trim()}`);
  }

  const copySection = `Copy to rewrite:\n${normalizeCopyToRewrite(input.userText)}`;
  const respondSection = "Respond with only the rewritten text.";

  const system = systemExtras.length > 0 ? `${SYSTEM_PROMPT}\n\n${systemExtras.join("\n")}` : SYSTEM_PROMPT;

  const contextWindow = input.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  const fixedTokens =
    estimateTokens(system) + estimateTokens([...userSections, copySection, respondSection].join("\n\n"));
  const historyBudget =
    contextWindow - fixedTokens - OUTPUT_RESERVE_TOKENS - SAFETY_MARGIN_TOKENS;
  const recent = filterCopywriterHistory(input.history ?? []).slice(-HISTORY_LIMIT);
  const history = trimHistoryToBudget(recent, historyBudget);
  if (history.length > 0) {
    const historyLines = history.map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.text}`);
    userSections.push(`Conversation history:\n${historyLines.join("\n")}`);
  }

  userSections.push(copySection);
  userSections.push(respondSection);

  const user = userSections.join("\n\n");
  const full = `${system}\n\n---\n\n${user}`;

  return { system, user, full };
}

export function parseCopywriterResponse(raw: string): { suggestedText: string; rationale?: string } {
  let trimmed = stripCopywriterMetaOutput(raw.trim());

  if (!trimmed) {
    return { suggestedText: "" };
  }

  const rewriteMatch = trimmed.match(/(?:Suggested rewrite|Rewrite):\s*([\s\S]+)/i);
  if (rewriteMatch?.[1]) {
    return { suggestedText: stripCopywriterMetaOutput(rewriteMatch[1].trim()) };
  }

  const lines = trimmed.split("\n");

  if (isCopywriterOffTopicRefusal(trimmed)) {
    return { suggestedText: trimmed };
  }

  if (OFF_TOPIC_PATTERN.test(trimmed)) {
    const withoutRefusal = lines
      .filter((line) => !OFF_TOPIC_PATTERN.test(line.trim()))
      .join("\n")
      .trim();

    if (withoutRefusal) {
      return { suggestedText: withoutRefusal };
    }
  }
  const lastMeaningful = [...lines].reverse().find((line) => line.trim().length > 0) ?? trimmed;

  if (lines.length > 8 && lastMeaningful.length < trimmed.length * 0.6) {
    return { suggestedText: lastMeaningful.trim() };
  }

  return { suggestedText: trimmed };
}

export function extractSuggestedTextFromAgentEvents(
  events: Array<{ type: string; payload?: Record<string, unknown> }>
): string {
  const finalEvent = events.find((event) => event.type === "text" && event.payload?.streamFinal === true);

  if (finalEvent) {
    return parseCopywriterResponse(String(finalEvent.payload?.text ?? "")).suggestedText;
  }

  return parseCopywriterResponse(accumulateAgentRunDisplayText(events)).suggestedText;
}

export function accumulateAgentRunDisplayText(
  events: Array<{ type: string; payload?: Record<string, unknown> }>
): string {
  const textEvents = events.filter(
    (event) => event.type === "text" && event.payload?.streamFinal !== true
  );

  const hasDeltas = textEvents.some((event) => event.payload?.streamDelta === true);
  const separator = hasDeltas ? "" : "\n";

  return textEvents
    .map((event) => String(event.payload?.text ?? ""))
    .filter(Boolean)
    .join(separator);
}
