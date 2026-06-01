import { readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { createCliAdapter, smokeCliAdapter, type CliAdapterConfig } from "../create-cli-adapter";
import { runCliCommand } from "../cli-runner";
import type {
  DevinProviderSettings,
  DevinReasoningCapabilityStatus,
  DevinReasoningPreference,
  DevinRuntimeOptions
} from "@writer/contracts";

import {
  buildModelSpecifier,
  getDevinReasoningOptionsForModel,
  getDevinReasoningProfile,
  normalizeDevinReasoningPreference
} from "./devin-reasoning";

export {
  buildModelSpecifier,
  getDevinReasoningOptionsForModel,
  getDevinReasoningProfile,
  normalizeDevinReasoningPreference
} from "./devin-reasoning";

/**
 * Default Devin model.
 *
 * On Dell's enterprise Windsurf plan (the one we ship against), `swe-1.6`
 * is the team-default and runs without consuming personal ACU credits —
 * verified live with `devin --model swe-1.6 -p ok`. Counter-intuitively,
 * `swe-1.6-fast` is a **different** model in this plan and DOES require
 * credits (Permission denied on the same account). Don't "upgrade" the
 * default to `-fast` without re-probing.
 *
 * Override per-session via the `DEVIN_MODEL` env var without touching code
 * (matches the CLI's own env contract). Run `devin --model X -p ok`
 * locally to confirm before swapping.
 */
const DEFAULT_DEVIN_MODEL = "swe-1.6";

/**
 * Temporary product gate: pin all Devin runs to the team-default SWE 1.6 tier
 * (no personal ACU on the Dell Windsurf plan). Re-enable model picker in the
 * Agents UI when this flag is false.
 */
export const DEVIN_MODEL_TEMPORARILY_PINNED = true;

export const PINNED_DEVIN_MODEL_ID = DEFAULT_DEVIN_MODEL;

/** Curated Devin models shown in Writer — order matches the Agents UI grouping. */
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

const DEVIN_MODEL_DISPLAY_LABELS: Record<(typeof DEVIN_CURATED_MODEL_IDS)[number], string> = {
  "claude-sonnet-4.6": "Claude Sonnet 4.6",
  "claude-opus-4.7": "Claude Opus 4.7",
  "claude-opus-4.8": "Claude Opus 4.8",
  "claude-haiku-4.5": "Claude Haiku 4.5",
  "gemini-3.1-pro": "Gemini 3.1 Pro",
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  "gpt-5.4": "ChatGPT 5.4",
  "gpt-5.4-mini": "ChatGPT 5.4 mini",
  "gpt-5.5": "ChatGPT 5.5",
  "swe-1.6": "SWE 1.6 (free)"
};

export function getDevinCuratedModelOptions(): string[] {
  return [...DEVIN_CURATED_MODEL_IDS];
}

export function getDevinModelDisplayLabel(modelId: string): string {
  return (
    DEVIN_MODEL_DISPLAY_LABELS[modelId as (typeof DEVIN_CURATED_MODEL_IDS)[number]] ?? modelId
  );
}

export function getDevinModelDisplayLabels(): Record<string, string> {
  return { ...DEVIN_MODEL_DISPLAY_LABELS };
}

export function normalizeDevinModelId(modelId: string): string {
  if (DEVIN_MODEL_TEMPORARILY_PINNED) {
    return PINNED_DEVIN_MODEL_ID;
  }
  const trimmed = modelId.trim();
  return (DEVIN_CURATED_MODEL_IDS as readonly string[]).includes(trimmed)
    ? trimmed
    : DEFAULT_DEVIN_MODEL;
}

type DevinRuntimeSettings = {
  modelId?: string;
  reasoningPreference?: DevinReasoningPreference;
  reasoningCapabilityStatus?: DevinReasoningCapabilityStatus;
};

let runtimeSettings: DevinRuntimeSettings = {};

export function setDevinRuntimeSettings(next: DevinRuntimeSettings): void {
  runtimeSettings = {
    modelId: next.modelId?.trim() || undefined,
    reasoningPreference: next.reasoningPreference,
    reasoningCapabilityStatus: next.reasoningCapabilityStatus
  };
}

export function getDevinRuntimeSettings(): DevinProviderSettings {
  const modelId = resolveDevinModelId();
  const profile = getDevinReasoningProfile(modelId);
  const preference = normalizeDevinReasoningPreference(
    modelId,
    runtimeSettings.reasoningPreference ?? "medium"
  );

  return {
    modelId,
    reasoningPreference: preference,
    reasoningCapabilityStatus:
      runtimeSettings.reasoningCapabilityStatus ?? profile.capabilityStatus
  };
}

export async function getDevinRuntimeOptions(_executable = "devin"): Promise<DevinRuntimeOptions> {
  const modelId = resolveDevinModelId();

  return {
    modelOptions: getDevinCuratedModelOptions(),
    modelLabels: getDevinModelDisplayLabels(),
    reasoningOptions: getDevinReasoningOptionsForModel(modelId)
  };
}

export function resolveDevinModelId(): string {
  if (DEVIN_MODEL_TEMPORARILY_PINNED) {
    return PINNED_DEVIN_MODEL_ID;
  }
  const persisted = runtimeSettings.modelId?.trim();
  if (persisted) {
    return normalizeDevinModelId(persisted);
  }
  const fromEnv = process.env.DEVIN_MODEL?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return DEFAULT_DEVIN_MODEL;
}

const DEVIN_TEMP_CONFIG_PATH = join(tmpdir(), "devin-writer-config.json");

/**
 * Write a temporary Devin config that overrides only `agent.model`, merging
 * all other fields from the real `~/.config/devin/config.json` so auth tokens
 * and other preferences survive.
 */
function writeDevinTempConfig(modelSpecifier: string): string {
  let base: Record<string, unknown> = {};
  try {
    const realConfig = join(homedir(), ".config", "devin", "config.json");
    base = JSON.parse(readFileSync(realConfig, "utf8")) as Record<string, unknown>;
  } catch {
    // Config file absent or unreadable — use an empty base; Devin will supply defaults.
  }

  const merged = {
    ...base,
    agent: {
      ...(base.agent as Record<string, unknown> | undefined),
      model: modelSpecifier
    }
  };

  writeFileSync(DEVIN_TEMP_CONFIG_PATH, JSON.stringify(merged, null, 2));
  return DEVIN_TEMP_CONFIG_PATH;
}

function buildDevinArgs(prompt: string): string[] {
  const modelId = resolveDevinModelId();
  const reasoning = normalizeDevinReasoningPreference(
    modelId,
    runtimeSettings.reasoningPreference ?? "medium"
  );
  const specifier = buildModelSpecifier(modelId, reasoning);

  if (specifier === modelId) {
    // No thinking extension — the public --model flag is sufficient.
    return ["--model", modelId, "-p", prompt];
  }

  // Extended internal specifier: must go through a config file.
  const configPath = writeDevinTempConfig(specifier);
  return ["--config", configPath, "-p", prompt];
}

export const devinCliConfig: CliAdapterConfig = {
  id: "devin",
  displayName: "Devin",
  runtimeKind: "hybrid",
  command: "devin",
  detectArgs: ["version"],
  unavailableMessage: "Install Devin for Terminal (`devin`) and ensure it is on your PATH.",
  needsAuthMessage: "Run `devin` and complete `/login` before using Devin in Writer.",
  buildRunArgs: buildDevinArgs,
  buildSmokeArgs: buildDevinArgs,
  probeAuth: probeDevinAuth,
  /** Guideline generation runs semantic + final Devin passes with large prompts. */
  runTimeoutMs: 300_000
};

export function createDevinAdapter() {
  return createCliAdapter(devinCliConfig);
}

async function probeDevinAuth(executable: string) {
  const smoke = await smokeCliAdapter(devinCliConfig, executable);
  if (smoke.ok) {
    return "ready" as const;
  }

  const message = smoke.message?.toLowerCase() ?? "";
  if (message.includes("login") || message.includes("auth") || message.includes("unauthorized")) {
    return "needs_auth" as const;
  }

  const probe = await runCliCommand({
    executable,
    args: buildDevinArgs("ok"),
    timeoutMs: 15_000
  });

  if (probe.exitCode === 0) {
    return "ready" as const;
  }

  const combined = `${probe.stderr} ${probe.stdout}`.toLowerCase();
  if (combined.includes("login") || combined.includes("auth")) {
    return "needs_auth" as const;
  }

  return "unknown" as const;
}
