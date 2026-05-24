import { createCliAdapter, smokeCliAdapter, type CliAdapterConfig } from "../create-cli-adapter";
import { runCliCommand } from "../cli-runner";

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

function devinModel(): string {
  return process.env.DEVIN_MODEL?.trim() || DEFAULT_DEVIN_MODEL;
}

function buildDevinArgs(prompt: string): string[] {
  return ["--model", devinModel(), "-p", prompt];
}

export const devinCliConfig: CliAdapterConfig = {
  id: "devin",
  displayName: "Devin (cloud-backed)",
  runtimeKind: "hybrid",
  command: "devin",
  detectArgs: ["version"],
  unavailableMessage: "Install Devin for Terminal (`devin`) and ensure it is on your PATH.",
  needsAuthMessage: "Run `devin` and complete `/login` before using Devin in Writer.",
  buildRunArgs: buildDevinArgs,
  buildSmokeArgs: buildDevinArgs,
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
