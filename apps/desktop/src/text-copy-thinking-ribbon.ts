import type { AgentRunEvent } from "@writer/contracts";

export type ThinkingRibbonPhase = "thinking" | "failed";

export type ThinkingRibbonInput = {
  runStatus?: string;
  events: AgentRunEvent[];
  assistantFailed?: boolean;
};

/** @deprecated Display uses THINKING_RIBBON_STATUS_MESSAGES rotation instead. */
export const THINKING_RIBBON_LABEL = "Thinking";

export const THINKING_RIBBON_FAILED_LABEL = "Failed";

export const THINKING_RIBBON_ROTATE_MS = 3000;

export const THINKING_RIBBON_STATUS_MESSAGES = [
  "Waking up neural pathways...",
  "Consulting the library...",
  "Mixing ingredients...",
  "Mining data veins...",
  "Connecting the dots...",
  "Doing some mental gymnastics...",
  "Thinking about tacos..."
] as const;

/** Random pick from the pool; never returns `current` when another option exists. */
export function pickThinkingRibbonStatusMessage(current?: string): string {
  const pool = THINKING_RIBBON_STATUS_MESSAGES;
  if (pool.length === 0) {
    return "";
  }
  if (pool.length === 1) {
    return pool[0];
  }
  const candidates = current ? pool.filter((message) => message !== current) : [...pool];
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index] ?? pool[0];
}

export function deriveThinkingRibbonPhase(input: ThinkingRibbonInput): ThinkingRibbonPhase {
  if (input.assistantFailed || input.runStatus === "failed" || input.runStatus === "canceled") {
    return "failed";
  }

  return "thinking";
}
