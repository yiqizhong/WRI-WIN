import { createCliAdapter, type CliAdapterConfig } from "../create-cli-adapter";

export const cursorAgentCliConfig: CliAdapterConfig = {
  id: "cursor-agent",
  displayName: "Cursor Agent",
  runtimeKind: "local",
  command: "cursor",
  detectArgs: ["agent", "--version"],
  unavailableMessage: "Install Cursor and ensure the `cursor` CLI supports `cursor agent`.",
  buildRunArgs: (prompt) => ["agent", "-p", "-f", prompt],
  buildSmokeArgs: (prompt) => ["agent", "-p", "-f", prompt]
};

export function createCursorAgentAdapter() {
  return createCliAdapter(cursorAgentCliConfig);
}
