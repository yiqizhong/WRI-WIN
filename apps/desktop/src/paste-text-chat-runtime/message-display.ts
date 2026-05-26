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

export function getMessageVariants(message: PasteTextMessage): string[] {
  if (message.variants && message.variants.length > 0) {
    return message.variants;
  }

  if (message.status === "complete") {
    const text = message.suggestedText ?? message.text;
    if (text && text !== "Rewriting…") {
      return [text];
    }
  }

  return [];
}

export function resolveVariantIndex(message: PasteTextMessage, localIndex?: number): number {
  const variants = getMessageVariants(message);
  if (variants.length === 0) {
    return 0;
  }

  const index = localIndex ?? message.variantIndex ?? variants.length - 1;
  return Math.max(0, Math.min(index, variants.length - 1));
}

export function messageVariantText(message: PasteTextMessage, localIndex?: number): string {
  const variants = getMessageVariants(message);
  if (variants.length === 0) {
    return message.suggestedText ?? message.text;
  }

  return variants[resolveVariantIndex(message, localIndex)] ?? message.text;
}

export function messagePreview(
  message: PasteTextMessage,
  streamingText?: string | null,
  options?: { variantIndex?: number }
): string {
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
    return messageVariantText(message, options?.variantIndex);
  }

  return message.text;
}

export function isTerminalRunStatus(status: string): boolean {
  return TERMINAL_RUN_STATUSES.has(status);
}

export const RUN_POLL_INTERVAL_MS = 500;
