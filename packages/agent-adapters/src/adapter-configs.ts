import type { CliAdapterConfig } from "./create-cli-adapter";
import { LLM_PROVIDER_ADAPTER_IDS } from "@writer/contracts";
import { cursorAgentCliConfig } from "./adapters/cursor-agent";
import { devinCliConfig } from "./adapters/devin";
import { createCursorAgentAdapter } from "./adapters/cursor-agent";
import { createDevinAdapter } from "./adapters/devin";

export const CLI_ADAPTER_IDS = LLM_PROVIDER_ADAPTER_IDS;

const configs: Record<string, CliAdapterConfig> = {
  "cursor-agent": cursorAgentCliConfig,
  devin: devinCliConfig
};

export function getCliAdapterConfig(adapterId: string): CliAdapterConfig | undefined {
  return configs[adapterId];
}

export function createProviderAdapters() {
  return [createCursorAgentAdapter(), createDevinAdapter()];
}
