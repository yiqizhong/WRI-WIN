import type { CliAdapterConfig } from "./create-cli-adapter";
import { claudeCodeCliConfig } from "./adapters/claude-code";
import { codexCliConfig } from "./adapters/codex";
import { cursorAgentCliConfig } from "./adapters/cursor-agent";
import { devinCliConfig } from "./adapters/devin";
import { createClaudeCodeAdapter } from "./adapters/claude-code";
import { createCodexAdapter } from "./adapters/codex";
import { createCursorAgentAdapter } from "./adapters/cursor-agent";
import { createDevinAdapter } from "./adapters/devin";

export const CLI_ADAPTER_IDS = ["claude-code", "codex", "cursor-agent", "devin"] as const;

const configs: Record<string, CliAdapterConfig> = {
  "claude-code": claudeCodeCliConfig,
  codex: codexCliConfig,
  "cursor-agent": cursorAgentCliConfig,
  devin: devinCliConfig
};

export function getCliAdapterConfig(adapterId: string): CliAdapterConfig | undefined {
  return configs[adapterId];
}

export function createProviderAdapters() {
  return [createClaudeCodeAdapter(), createCodexAdapter(), createCursorAgentAdapter(), createDevinAdapter()];
}
