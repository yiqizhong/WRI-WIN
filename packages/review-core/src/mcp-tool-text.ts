export function extractMcpToolText(result: unknown): string | null {
  if (!result || typeof result !== "object") {
    return null;
  }

  const content = (result as { content?: unknown }).content;

  if (!Array.isArray(content)) {
    if (typeof (result as { text?: string }).text === "string") {
      return (result as { text: string }).text;
    }

    return null;
  }

  const parts: string[] = [];

  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }

    const typed = block as { type?: string; text?: string };

    if (typed.type === "text" && typeof typed.text === "string") {
      parts.push(typed.text);
    }
  }

  return parts.length > 0 ? parts.join("\n") : null;
}
