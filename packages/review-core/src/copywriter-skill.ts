export type CopywriterMessage = {
  role: "user" | "assistant";
  text: string;
};

export type CopywriterSkillInput = {
  backgroundContext?: string;
  brandVoice?: string;
  history?: CopywriterMessage[];
  userText: string;
  rowContext?: string;
};

export type CopywriterPrompt = {
  system: string;
  user: string;
  full: string;
};

const SYSTEM_PROMPT = `You are a Senior Software Copywriter specializing in UX and product interface text.

Your only job is to rewrite user-supplied copy according to the provided background context and writing rules.

Hard constraints:
- Output ONLY the rewritten text. No preamble, no markdown fences, no bullet lists unless the source is a list.
- Do not answer general questions, chit-chat, or tasks unrelated to copy rewriting.
- If the request is off-topic, respond with: "I can only rewrite UX copy. Paste the text you want improved."
- Preserve intent, tone constraints, and terminology from the background context.
- Keep rewrites concise and appropriate for software UI.`;

const HISTORY_LIMIT = 6;

export function buildCopywriterPrompt(input: CopywriterSkillInput): CopywriterPrompt {
  const userSections: string[] = [];

  if (input.backgroundContext?.trim()) {
    userSections.push(`UI background and writing rules:\n${input.backgroundContext.trim()}`);
  }

  if (input.brandVoice?.trim()) {
    userSections.push(`Brand voice:\n${input.brandVoice.trim()}`);
  }

  if (input.rowContext?.trim()) {
    userSections.push(`Structured row context:\n${input.rowContext.trim()}`);
  }

  const history = (input.history ?? []).slice(-HISTORY_LIMIT);
  if (history.length > 0) {
    const historyLines = history.map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.text}`);
    userSections.push(`Conversation history:\n${historyLines.join("\n")}`);
  }

  userSections.push(`Copy to rewrite:\n${input.userText.trim()}`);
  userSections.push("Respond with only the rewritten text.");

  const user = userSections.join("\n\n");
  const full = `${SYSTEM_PROMPT}\n\n---\n\n${user}`;

  return { system: SYSTEM_PROMPT, user, full };
}

export function parseCopywriterResponse(raw: string): { suggestedText: string; rationale?: string } {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { suggestedText: "" };
  }

  const rewriteMatch = trimmed.match(/(?:Suggested rewrite|Rewrite):\s*([\s\S]+)/i);
  if (rewriteMatch?.[1]) {
    return { suggestedText: rewriteMatch[1].trim() };
  }

  const offTopicPattern = /I can only rewrite UX copy/i;
  if (offTopicPattern.test(trimmed)) {
    return { suggestedText: trimmed };
  }

  const lines = trimmed.split("\n");
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
