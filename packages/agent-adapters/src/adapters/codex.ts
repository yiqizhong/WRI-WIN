import { createCliAdapter, type CliAdapterConfig } from "../create-cli-adapter";

export const codexCliConfig: CliAdapterConfig = {
  id: "codex",
  displayName: "Codex",
  runtimeKind: "local",
  command: "codex",
  detectArgs: ["--version"],
  unavailableMessage: "Install OpenAI Codex CLI (`npm i -g @openai/codex`) and ensure `codex` is on your PATH.",
  buildRunArgs: (prompt) => ["exec", "--skip-git-repo-check", prompt],
  buildSmokeArgs: (prompt) => ["exec", "--skip-git-repo-check", prompt]
};

export function createCodexAdapter() {
  return createCliAdapter(codexCliConfig);
}
