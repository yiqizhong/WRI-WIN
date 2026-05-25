import type { AgentRunEvent, PasteTextMessage } from "@writer/contracts";

const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "canceled"]);

export function streamingTextFromEvents(events: AgentRunEvent[]): string {
  const textEvents = events.filter(
    (event) => event.type === "text" && event.payload?.streamFinal !== true
  );
  const hasDeltas = textEvents.some((event) => event.payload?.streamDelta === true);

  return textEvents
    .map((event) => String(event.payload?.text ?? ""))
    .filter(Boolean)
    .join(hasDeltas ? "" : "\n");
}

export function messagePreview(message: PasteTextMessage, streamingText?: string | null): string {
  if (message.status === "pending") {
    if (streamingText) {
      return streamingText;
    }

    return "Rewriting…";
  }

  if (message.status === "failed") {
    return message.errorMessage ?? message.text;
  }

  if (message.role === "assistant") {
    return message.suggestedText ?? message.text;
  }

  return message.text;
}

export function isTerminalRunStatus(status: string): boolean {
  return TERMINAL_RUN_STATUSES.has(status);
}

export const RUN_POLL_INTERVAL_MS = 500;
