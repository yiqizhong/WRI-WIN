import type { AgentRunEvent } from "@writer/contracts";

export type ThinkingRibbonPhase = "thinking" | "failed";

export type ThinkingRibbonInput = {
  runStatus?: string;
  events: AgentRunEvent[];
  assistantFailed?: boolean;
};

export const THINKING_RIBBON_LABEL = "Thinking";

export const THINKING_RIBBON_FAILED_LABEL = "Failed";

export function deriveThinkingRibbonPhase(input: ThinkingRibbonInput): ThinkingRibbonPhase {
  if (input.assistantFailed || input.runStatus === "failed" || input.runStatus === "canceled") {
    return "failed";
  }

  return "thinking";
}
