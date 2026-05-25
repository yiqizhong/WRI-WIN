import type { AgentRunEvent } from "@writer/contracts";

export type ThinkingRibbonPhase =
  | "connecting"
  | "loading-guidelines"
  | "thinking"
  | "integrating"
  | "failed";

export type ThinkingRibbonInput = {
  runStatus?: string;
  events: AgentRunEvent[];
  assistantFailed?: boolean;
};

const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "canceled"]);

export function deriveThinkingRibbonPhase(input: ThinkingRibbonInput): ThinkingRibbonPhase {
  if (input.assistantFailed || input.runStatus === "failed" || input.runStatus === "canceled") {
    return "failed";
  }

  const events = input.events;
  if (events.length === 0) {
    return "connecting";
  }

  const hasStreamDelta = events.some(
    (event) => event.type === "text" && event.payload?.streamDelta === true
  );
  const hasStreamFinal = events.some(
    (event) => event.type === "text" && event.payload?.streamFinal === true
  );
  const hasNonText = events.some((event) => event.type !== "text");

  if (
    hasStreamFinal ||
    (input.runStatus && TERMINAL_RUN_STATUSES.has(input.runStatus) && !hasStreamDelta)
  ) {
    return "integrating";
  }

  if (hasStreamDelta) {
    return "thinking";
  }

  if (hasNonText) {
    return "loading-guidelines";
  }

  return "connecting";
}

export const THINKING_RIBBON_PHASES: ThinkingRibbonPhase[] = [
  "connecting",
  "loading-guidelines",
  "thinking",
  "integrating"
];

export const THINKING_RIBBON_LABELS: Record<ThinkingRibbonPhase, string> = {
  connecting: "Connecting",
  "loading-guidelines": "Loading guidelines",
  thinking: "Thinking",
  integrating: "Integrating",
  failed: "Failed"
};
