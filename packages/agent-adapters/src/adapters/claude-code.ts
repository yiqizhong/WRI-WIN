import { createCliAdapter, type CliAdapterConfig } from "../create-cli-adapter";

export const claudeCodeCliConfig: CliAdapterConfig = {
  id: "claude-code",
  displayName: "Claude Code",
  runtimeKind: "local",
  command: "claude",
  detectArgs: ["--version"],
  unavailableMessage: "Install Claude Code CLI and ensure `claude` is on your PATH.",
  buildRunArgs: (prompt) => ["-p", prompt, "--disallowed-tools", "Bash", "Edit", "Write", "MultiEdit"],
  buildSmokeArgs: (prompt) => ["-p", prompt, "--disallowed-tools", "Bash", "Edit", "Write"]
};

export function createClaudeCodeAdapter() {
  return createCliAdapter(claudeCodeCliConfig);
}
