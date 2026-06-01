/** Curated Devin models — keep in sync with packages/agent-adapters/src/adapters/devin.ts */
export const DEVIN_CURATED_MODEL_IDS = [
  "claude-sonnet-4.6",
  "claude-opus-4.7",
  "claude-opus-4.8",
  "claude-haiku-4.5",
  "gemini-3.1-pro",
  "gemini-3.5-flash",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.5",
  "swe-1.6"
] as const;

export const DEVIN_MODEL_LABELS: Record<(typeof DEVIN_CURATED_MODEL_IDS)[number], string> = {
  "claude-sonnet-4.6": "Claude Sonnet 4.6",
  "claude-opus-4.7": "Claude Opus 4.7",
  "claude-opus-4.8": "Claude Opus 4.8",
  "claude-haiku-4.5": "Claude Haiku 4.5",
  "gemini-3.1-pro": "Gemini 3.1 Pro",
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  "gpt-5.4": "ChatGPT 5.4",
  "gpt-5.4-mini": "ChatGPT 5.4 mini",
  "gpt-5.5": "ChatGPT 5.5",
  "swe-1.6": "SWE 1.6"
};

export function resolveDevinModelOptions(_apiOptions: string[]): string[] {
  return [...DEVIN_CURATED_MODEL_IDS];
}

export function resolveDevinModelLabel(
  modelId: string,
  apiLabels: Record<string, string> = {}
): string {
  return (
    apiLabels[modelId] ??
    DEVIN_MODEL_LABELS[modelId as (typeof DEVIN_CURATED_MODEL_IDS)[number]] ??
    modelId
  );
}
