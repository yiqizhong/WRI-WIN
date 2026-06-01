import type {
  DevinReasoningCapabilityStatus,
  DevinReasoningPreference
} from "@writer/contracts";

/**
 * Per-model reasoning support derived from Devin CLI internals (model registry
 * strings in the `devin` binary) and live `--config` acceptance probes — not
 * invented UI labels.
 *
 * Devin has no public `--reasoning` flag. Thinking is selected by writing an
 * internal model specifier to `config.json` / `--config`.
 */
export type DevinReasoningProfile = {
  options: DevinReasoningPreference[];
  capabilityStatus: DevinReasoningCapabilityStatus;
};

const ALL_LEVELS: DevinReasoningPreference[] = ["off", "low", "medium", "high"];

function hyphenateClaudeModelId(modelId: string): string {
  return modelId.replace(/(\d+)\.(\d+)/, "$1-$2").replace(/-(medium|high|xhigh|max-thinking|thinking(-1m|-fast)?)$/, "");
}

function isClaudeOpus47(modelId: string): boolean {
  return /^claude-opus-4[.-]7$/i.test(modelId);
}

function isSweModel(modelId: string): boolean {
  return /^swe-/i.test(modelId);
}

function isClaudeThinkingToggleModel(modelId: string): boolean {
  if (!/^claude-/i.test(modelId) || isClaudeOpus47(modelId)) {
    return false;
  }
  // Binary registry exposes only `<base>` and `<base>-thinking` for sonnet/opus (not haiku).
  return /^claude-(sonnet|opus)-/i.test(modelId);
}

export function getDevinReasoningProfile(modelId: string): DevinReasoningProfile {
  if (isSweModel(modelId)) {
    return {
      options: ALL_LEVELS,
      capabilityStatus: "applied"
    };
  }

  if (isClaudeOpus47(modelId)) {
    return {
      options: ALL_LEVELS,
      capabilityStatus: "applied"
    };
  }

  if (isClaudeThinkingToggleModel(modelId)) {
    // Only two distinct specifiers exist: base model vs `<base>-thinking`.
    return {
      options: ["off", "high"],
      capabilityStatus: "mapped"
    };
  }

  return {
    options: [],
    capabilityStatus: "unsupported"
  };
}

export function normalizeDevinReasoningPreference(
  modelId: string,
  preference: DevinReasoningPreference
): DevinReasoningPreference {
  const { options } = getDevinReasoningProfile(modelId);
  if (options.length === 0) {
    return preference;
  }
  if (options.includes(preference)) {
    return preference;
  }
  if (preference === "off") {
    return "off";
  }

  const thinkingTiers = options.filter((option) => option !== "off");
  return thinkingTiers[thinkingTiers.length - 1] ?? "off";
}

/**
 * Map UI preference → Devin internal model specifier for `--config`.
 * Returns the public `modelId` unchanged when no thinking override applies.
 */
export function buildModelSpecifier(modelId: string, reasoning: DevinReasoningPreference): string {
  const profile = getDevinReasoningProfile(modelId);
  const preference = normalizeDevinReasoningPreference(modelId, reasoning);

  if (profile.capabilityStatus === "unsupported" || preference === "off") {
    return modelId;
  }

  if (isSweModel(modelId)) {
    const tauByPreference: Record<DevinReasoningPreference, string> = {
      off: modelId,
      low: "tau-low",
      medium: "tau-medium",
      high: "tau-max"
    };
    return tauByPreference[preference];
  }

  if (isClaudeOpus47(modelId)) {
    const opusByPreference: Record<DevinReasoningPreference, string> = {
      off: "claude-opus-4-7",
      low: "claude-opus-4-7-medium",
      medium: "claude-opus-4-7-high",
      high: "claude-opus-4-7-max-thinking"
    };
    return opusByPreference[preference];
  }

  if (isClaudeThinkingToggleModel(modelId)) {
    return `${hyphenateClaudeModelId(modelId)}-thinking`;
  }

  return modelId;
}

export function getDevinReasoningOptionsForModel(modelId: string): DevinReasoningPreference[] {
  return getDevinReasoningProfile(modelId).options;
}
