export type StreamJsonParseResult =
  | { kind: "delta"; text: string }
  | { kind: "final"; text: string };

function extractAssistantText(payload: Record<string, unknown>): string | null {
  const message = payload.message;

  if (!message || typeof message !== "object") {
    return null;
  }

  const content = (message as { content?: unknown }).content;

  if (!Array.isArray(content)) {
    return null;
  }

  const text = content
    .filter((part): part is { type?: string; text?: string } => typeof part === "object" && part !== null)
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");

  return text.length > 0 ? text : null;
}

export function parseCursorAgentStreamLine(line: string): StreamJsonParseResult | null {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;

    if (parsed.type === "assistant" && typeof parsed.timestamp_ms === "number") {
      const text = extractAssistantText(parsed);
      return text ? { kind: "delta", text } : null;
    }

    if (parsed.type === "result" && parsed.subtype === "success" && typeof parsed.result === "string") {
      return { kind: "final", text: parsed.result };
    }

    return null;
  } catch {
    return null;
  }
}
