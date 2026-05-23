import { randomUUID } from "node:crypto";

import type { AgentAdapter, AgentRun, AgentRunEvent, ConnectionDiagnostic } from "@writer/contracts";

import { commandExists, runCliCommand, spawnCliStream, type CliRunResult } from "./cli-runner";
import type { AgentAdapterImplementation, AgentDetectionResult, AgentRunHandle, AgentRunRequest } from "./types";

export type AgentAuthState = "ready" | "needs_auth" | "unknown";
export type AgentRuntimeKind = "local" | "hybrid";

export type CliAdapterConfig = {
  id: string;
  displayName: string;
  runtimeKind: AgentRuntimeKind;
  command: string;
  detectArgs?: string[];
  unavailableMessage: string;
  needsAuthMessage?: string;
  buildRunArgs: (prompt: string) => string[];
  buildSmokeArgs?: (prompt: string) => string[];
  probeAuth?: (executable: string) => Promise<AgentAuthState>;
  runTimeoutMs?: number;
  smokeTimeoutMs?: number;
};

const DEFAULT_RUN_TIMEOUT_MS = 120_000;
const DEFAULT_SMOKE_TIMEOUT_MS = 45_000;
const SMOKE_PROMPT = "Reply with exactly OK";

export function createCliAdapter(config: CliAdapterConfig): AgentAdapterImplementation {
  return {
    id: config.id,
    detect: () => detectCliAdapter(config),
    run: (request) => runCliAdapter(config, request)
  };
}

export async function detectCliAdapter(config: CliAdapterConfig): Promise<AgentDetectionResult> {
  const executablePath = await commandExists(config.command);

  if (!executablePath) {
    return buildDetection(config, {
      available: false,
      setupMessage: config.unavailableMessage,
      diagnostic: {
        code: "missing_command",
        severity: "error",
        message: `${config.displayName} command was not found on PATH.`,
        recoveryAction: config.unavailableMessage,
        command: config.command
      }
    });
  }

  const detectArgs = config.detectArgs ?? ["--version"];
  const probe = await runCliCommand({
    executable: executablePath,
    args: detectArgs,
    timeoutMs: 10_000
  });

  if (!probeSucceeded(probe)) {
    const diagnostic = diagnosticFromProbeResult(config, probe, executablePath);
    const hint = diagnostic.code === "broken_executable"
      ? `${config.unavailableMessage} (binary wrapper found but executable failed — try reinstalling ${config.command}).`
      : config.unavailableMessage;

    return buildDetection(config, {
      available: false,
      executablePath,
      setupMessage: hint,
      diagnostic
    });
  }

  const authState = config.probeAuth ? await config.probeAuth(executablePath) : "ready";

  if (authState === "needs_auth") {
    return buildDetection(config, {
      available: false,
      executablePath,
      authState,
      setupMessage: config.needsAuthMessage ?? `Authenticate ${config.displayName} before use.`,
      diagnostic: {
        code: "needs_auth",
        severity: "warning",
        message: `${config.displayName} requires authentication before use.`,
        recoveryAction: config.needsAuthMessage ?? `Authenticate ${config.displayName} before use.`,
        command: executablePath
      }
    });
  }

  return buildDetection(config, {
    available: true,
    executablePath,
    authState,
    diagnostic: {
      code: "ready",
      severity: "info",
      message: `${config.displayName} is ready.`,
      command: executablePath
    }
  });
}

export async function smokeCliAdapter(
  config: CliAdapterConfig,
  executablePath: string
): Promise<{ ok: boolean; output?: string; message?: string; diagnostic?: ConnectionDiagnostic }> {
  const buildSmoke = config.buildSmokeArgs ?? config.buildRunArgs;
  const result = await runCliCommand({
    executable: executablePath,
    args: buildSmoke(SMOKE_PROMPT),
    timeoutMs: config.smokeTimeoutMs ?? DEFAULT_SMOKE_TIMEOUT_MS
  });

  if (result.cancelled || result.timedOut) {
    const diagnostic = diagnosticFromSmokeResult(config, result, executablePath);
    return { ok: false, message: diagnostic.message, diagnostic };
  }

  if (!probeSucceeded(result)) {
    const diagnostic = diagnosticFromSmokeResult(config, result, executablePath);
    return {
      ok: false,
      message: diagnostic.message,
      diagnostic
    };
  }

  return {
    ok: true,
    output: trimOutput(result.stdout),
    diagnostic: {
      code: "ready",
      severity: "info",
      message: `${config.displayName} smoke test passed.`,
      command: executablePath,
      stdoutSnippet: trimOutput(result.stdout)
    }
  };
}

async function runCliAdapter(config: CliAdapterConfig, request: AgentRunRequest): Promise<AgentRunHandle> {
  const detection = await detectCliAdapter(config);

  if (!detection.adapter.available || !detection.adapter.executablePath) {
    return failedRunHandle(config.id, request, detection.adapter.setupMessage ?? config.unavailableMessage);
  }

  const startedAt = new Date().toISOString();
  const runId = `run-${config.id}-${Date.now()}`;
  const run: AgentRun = {
    id: runId,
    sessionId: request.sessionId,
    adapterId: config.id,
    status: "running",
    prompt: request.prompt,
    startedAt
  };

  const stream = spawnCliStream({
    executable: detection.adapter.executablePath,
    args: config.buildRunArgs(request.prompt),
    timeoutMs: config.runTimeoutMs ?? DEFAULT_RUN_TIMEOUT_MS
  });

  let cancelled = false;
  let stderr = "";

  stream.process.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  const timeout =
    config.runTimeoutMs ?? DEFAULT_RUN_TIMEOUT_MS
      ? setTimeout(() => {
          if (!cancelled) {
            stream.cancel();
          }
        }, config.runTimeoutMs ?? DEFAULT_RUN_TIMEOUT_MS)
      : undefined;

  async function* eventStream(): AsyncGenerator<AgentRunEvent> {
    const chunks: string[] = [];

    try {
      for await (const line of stream.lines) {
        if (cancelled) {
          break;
        }

        chunks.push(line);
        yield textEvent(runId, line);
      }

      const exitCode = await waitForClose(stream.process);

      if (cancelled) {
        run.status = "canceled";
        run.endedAt = new Date().toISOString();
        yield canceledEvent(runId, run.endedAt);
        return;
      }

      if (exitCode !== 0) {
        run.status = "failed";
        run.endedAt = new Date().toISOString();
        yield errorEvent(runId, trimOutput(stderr) || `Process exited with code ${exitCode ?? "unknown"}`);
        return;
      }

      if (chunks.length === 0 && stderr.trim()) {
        yield textEvent(runId, trimOutput(stderr));
      }

      run.status = "completed";
      run.endedAt = new Date().toISOString();
      yield completedEvent(runId, run.endedAt);
    } catch (error) {
      run.status = "failed";
      run.endedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : "Agent run failed";
      yield errorEvent(runId, message);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  return {
    run,
    events: eventStream(),
    cancel: async () => {
      cancelled = true;
      run.status = "canceled";
      run.endedAt = new Date().toISOString();
      stream.cancel();
    }
  };
}

function buildDetection(
  config: CliAdapterConfig,
  input: {
    available: boolean;
    executablePath?: string;
    setupMessage?: string;
    authState?: AgentAuthState;
    diagnostic?: ConnectionDiagnostic;
  }
): AgentDetectionResult {
  const adapter: AgentAdapter = {
    id: config.id,
    displayName: config.displayName,
    available: input.available,
    executablePath: input.executablePath,
    setupMessage: input.setupMessage,
    runtimeKind: config.runtimeKind,
    authState: input.authState ?? (input.available ? "ready" : "unknown"),
    diagnostic: input.diagnostic,
    capabilities: [{ id: "review", label: "UX copy review", enabled: input.available }]
  };

  return { adapter };
}

function probeSucceeded(result: CliRunResult): boolean {
  return result.exitCode === 0 && !result.timedOut && !result.cancelled;
}

function diagnosticFromProbeResult(
  config: CliAdapterConfig,
  result: CliRunResult,
  command: string
): ConnectionDiagnostic {
  if (isBrokenExecutableFailure(result)) {
    return {
      code: "broken_executable",
      severity: "error",
      message: `${config.displayName} was found but its executable could not start.`,
      recoveryAction: `Reinstall or repair ${config.displayName}, then run detection again.`,
      command,
      exitCode: result.exitCode,
      stdoutSnippet: trimOutput(result.stdout),
      stderrSnippet: trimOutput(result.stderr || (result.spawnError ?? ""))
    };
  }

  if (result.timedOut) {
    return {
      code: "timeout",
      severity: "error",
      message: `${config.displayName} version probe timed out.`,
      recoveryAction: `Check that ${config.displayName} can run non-interactively from a terminal.`,
      command,
      exitCode: result.exitCode,
      stdoutSnippet: trimOutput(result.stdout),
      stderrSnippet: trimOutput(result.stderr)
    };
  }

  return {
    code: "version_probe_failed",
    severity: "error",
    message: trimOutput(result.stderr || result.stdout) || `${config.displayName} version probe failed.`,
    recoveryAction: config.unavailableMessage,
    command,
    exitCode: result.exitCode,
    stdoutSnippet: trimOutput(result.stdout),
    stderrSnippet: trimOutput(result.stderr || (result.spawnError ?? ""))
  };
}

function diagnosticFromSmokeResult(
  config: CliAdapterConfig,
  result: CliRunResult,
  command: string
): ConnectionDiagnostic {
  if (isBrokenExecutableFailure(result)) {
    return {
      code: "broken_executable",
      severity: "error",
      message: `${config.displayName} was found but its executable could not start.`,
      recoveryAction: `Reinstall or repair ${config.displayName}, then test the connection again.`,
      command,
      exitCode: result.exitCode,
      stdoutSnippet: trimOutput(result.stdout),
      stderrSnippet: trimOutput(result.stderr || (result.spawnError ?? ""))
    };
  }

  if (result.timedOut || result.cancelled) {
    return {
      code: "timeout",
      severity: "error",
      message: `${config.displayName} smoke test timed out.`,
      recoveryAction: `Check login state and that ${config.displayName} can answer a short prompt.`,
      command,
      exitCode: result.exitCode,
      stdoutSnippet: trimOutput(result.stdout),
      stderrSnippet: trimOutput(result.stderr)
    };
  }

  if (looksLikeAuthFailure(result)) {
    return {
      code: "needs_auth",
      severity: "warning",
      message: `${config.displayName} needs authentication before use.`,
      recoveryAction: config.needsAuthMessage ?? `Authenticate ${config.displayName} and test again.`,
      command,
      exitCode: result.exitCode,
      stdoutSnippet: trimOutput(result.stdout),
      stderrSnippet: trimOutput(result.stderr)
    };
  }

  return {
    code: "smoke_failed",
    severity: "error",
    message: trimOutput(result.stderr || result.stdout) || `${config.displayName} smoke test failed.`,
    recoveryAction: `Run ${config.displayName} manually to confirm it can answer a non-interactive prompt.`,
    command,
    exitCode: result.exitCode,
    stdoutSnippet: trimOutput(result.stdout),
    stderrSnippet: trimOutput(result.stderr || (result.spawnError ?? ""))
  };
}

function isBrokenExecutableFailure(result: CliRunResult): boolean {
  const combined = `${result.errorCode ?? ""} ${result.spawnError ?? ""} ${result.stderr} ${result.stdout}`;
  return combined.includes("ENOENT") && combined.toLowerCase().includes("spawn");
}

function looksLikeAuthFailure(result: CliRunResult): boolean {
  const combined = `${result.stderr} ${result.stdout}`.toLowerCase();
  return combined.includes("login") || combined.includes("auth") || combined.includes("unauthorized");
}

function trimOutput(value: string): string {
  return value.trim().slice(0, 4_000);
}

function waitForClose(process: { on: (event: string, listener: (...args: unknown[]) => void) => void }): Promise<number | null> {
  return new Promise((resolve) => {
    process.on("close", (code) => resolve(typeof code === "number" ? code : null));
    process.on("error", () => resolve(1));
  });
}

function failedRunHandle(adapterId: string, request: AgentRunRequest, message: string): AgentRunHandle {
  const startedAt = new Date().toISOString();
  const runId = `run-${adapterId}-${randomUUID()}`;
  const run: AgentRun = {
    id: runId,
    sessionId: request.sessionId,
    adapterId,
    status: "failed",
    prompt: request.prompt,
    startedAt,
    endedAt: startedAt
  };

  async function* events() {
    yield errorEvent(runId, message);
  }

  return { run, events: events(), cancel: async () => undefined };
}

function textEvent(runId: string, text: string): AgentRunEvent {
  return {
    id: `evt-${randomUUID()}`,
    runId,
    type: "text",
    timestamp: new Date().toISOString(),
    payload: { text }
  };
}

function errorEvent(runId: string, message: string): AgentRunEvent {
  return {
    id: `evt-${randomUUID()}`,
    runId,
    type: "error",
    timestamp: new Date().toISOString(),
    payload: { message }
  };
}

function completedEvent(runId: string, timestamp: string): AgentRunEvent {
  return {
    id: `evt-${randomUUID()}`,
    runId,
    type: "completed",
    timestamp,
    payload: {}
  };
}

function canceledEvent(runId: string, timestamp: string): AgentRunEvent {
  return {
    id: `evt-${randomUUID()}`,
    runId,
    type: "canceled",
    timestamp,
    payload: {}
  };
}
