import { createCliAdapter, smokeCliAdapter, type CliAdapterConfig } from "../create-cli-adapter";
import { runCliCommand } from "../cli-runner";

export const devinCliConfig: CliAdapterConfig = {
  id: "devin",
  displayName: "Devin (cloud-backed)",
  runtimeKind: "hybrid",
  command: "devin",
  detectArgs: ["version"],
  unavailableMessage: "Install Devin for Terminal (`devin`) and ensure it is on your PATH.",
  needsAuthMessage: "Run `devin` and complete `/login` before using Devin in Writer.",
  buildRunArgs: (prompt) => ["-p", prompt],
  buildSmokeArgs: (prompt) => ["-p", prompt],
  probeAuth: probeDevinAuth
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
    args: ["-p", "ok"],
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
