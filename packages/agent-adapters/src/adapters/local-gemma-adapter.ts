import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { join } from "node:path";

import type { AgentAdapter, AgentRun, AgentRunEvent, LocalModelState } from "@writer/contracts";

import type {
  AgentAdapterImplementation,
  AgentDetectionResult,
  AgentRunHandle,
  AgentRunRequest
} from "../types";
import { commandExists } from "../cli-runner";

const ADAPTER_ID = "local-gemma";
const DISPLAY_NAME = "Local Gemma";

function getGpuLayers(): string {
  return process.env["WRITER_GPU_LAYERS"] ?? "99";
}

// Returns true when an NVIDIA GPU is reachable.
// Skipped when WRITER_GPU_LAYERS is explicitly set (caller asserts GPU present).
// WRITER_GPU_LAYERS="0" disables GPU enforcement entirely (dev / CI without GPU).
async function detectNvidiaGpu(): Promise<boolean> {
  if (process.env["WRITER_GPU_LAYERS"] !== undefined) return true;
  return new Promise((resolve) => {
    const child = spawn("nvidia-smi", [], {
      stdio: ["ignore", "ignore", "ignore"],
      shell: false,
      windowsHide: true
    } as Parameters<typeof spawn>[2]);
    child.on("close", (code: number | null) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

export type LocalGemmaAdapterOptions = {
  getModelState: () => LocalModelState | null;
};

async function getLlamaBinaryPath(): Promise<string | null> {
  // 1. Explicit override for dev/CI.
  const override = process.env["WRITER_LLAMA_CLI"];
  if (override) return override;

  // 2. Bundled binary shipped with the Electron app (production).
  //    Electron main passes WRITER_RESOURCES_PATH=process.resourcesPath to the daemon.
  const resourcesPath = process.env["WRITER_RESOURCES_PATH"];
  if (resourcesPath) {
    const binaryName = process.platform === "win32" ? "llama-cli.exe" : "llama-cli";
    const bundledPath = join(resourcesPath, "llama", binaryName);
    try {
      await stat(bundledPath);
      return bundledPath;
    } catch {
      // Not present in resources — fall through to PATH.
    }
  }

  // 3. System PATH (dev machines with llama.cpp installed).
  return commandExists("llama-cli");
}

function buildAdapter(input: {
  available: boolean;
  setupMessage?: string;
  binaryPath?: string;
  modelPath?: string;
  diagnosticCode?: import("@writer/contracts").ConnectionDiagnosticCode;
}): AgentDetectionResult {
  const adapter: AgentAdapter = {
    id: ADAPTER_ID,
    displayName: DISPLAY_NAME,
    available: input.available,
    runtimeKind: "local",
    authState: input.available ? "ready" : "unknown",
    setupMessage: input.setupMessage,
    executablePath: input.binaryPath,
    diagnostic: input.available
      ? { code: "ready", severity: "info", message: `${DISPLAY_NAME} is ready.`, command: input.binaryPath }
      : {
          code: input.diagnosticCode ?? "not_installed",
          severity: "error",
          message: input.setupMessage ?? `${DISPLAY_NAME} model is not installed.`,
          recoveryAction: "Download the model from the Local Models panel."
        },
    capabilities: [{ id: "review", label: "UX copy review", enabled: input.available }]
  };
  return { adapter };
}

async function detect(getModelState: () => LocalModelState | null): Promise<AgentDetectionResult> {
  const modelState = getModelState();
  const status = modelState?.status ?? "not_installed";

  if (status !== "installed" && status !== "ready") {
    const messages: Record<string, string> = {
      not_installed: "Download the model from the Local Models panel.",
      downloading: "Model is downloading. Wait for it to complete.",
      verifying: "Model is being verified. Wait for it to complete.",
      failed: "Model download failed. Retry from the Local Models panel."
    };
    const codeMap: Record<string, string> = {
      not_installed: "not_installed",
      downloading: "downloading",
      verifying: "verifying",
      failed: "install_failed"
    };
    return buildAdapter({
      available: false,
      setupMessage: messages[status] ?? "Model is not ready.",
      diagnosticCode: (codeMap[status] ?? "not_installed") as import("@writer/contracts").ConnectionDiagnosticCode
    });
  }

  const binaryPath = await getLlamaBinaryPath();

  if (!binaryPath) {
    return buildAdapter({
      available: false,
      setupMessage:
        "llama-cli not found. Install llama.cpp or set WRITER_LLAMA_CLI to the binary path."
    });
  }

  const layers = getGpuLayers();
  if (layers !== "0") {
    const gpuOk = await detectNvidiaGpu();
    if (!gpuOk) {
      return buildAdapter({
        available: false,
        setupMessage:
          "NVIDIA GPU not detected. Install NVIDIA drivers, or set WRITER_GPU_LAYERS=0 to disable GPU enforcement.",
        diagnosticCode: "gpu_not_available"
      });
    }
  }

  return buildAdapter({
    available: true,
    binaryPath,
    modelPath: modelState?.modelPath ?? undefined
  });
}

function failedHandle(runId: string, request: AgentRunRequest, message: string): AgentRunHandle {
  const startedAt = new Date().toISOString();
  const run: AgentRun = {
    id: runId,
    sessionId: request.sessionId,
    adapterId: ADAPTER_ID,
    status: "failed",
    prompt: request.prompt,
    startedAt,
    endedAt: startedAt
  };

  async function* events(): AsyncGenerator<AgentRunEvent> {
    yield {
      id: `evt-${randomUUID()}`,
      runId,
      type: "error",
      timestamp: startedAt,
      payload: { message }
    };
  }

  return { run, events: events(), cancel: async () => undefined };
}

async function run(
  request: AgentRunRequest,
  getModelState: () => LocalModelState | null
): Promise<AgentRunHandle> {
  const runId = `run-${ADAPTER_ID}-${randomUUID()}`;
  const startedAt = new Date().toISOString();

  const detection = await detect(getModelState);

  if (!detection.adapter.available || !detection.adapter.executablePath) {
    return failedHandle(
      runId,
      request,
      detection.adapter.setupMessage ?? "Local Gemma is not available."
    );
  }

  const modelState = getModelState();
  if (!modelState?.modelPath) {
    return failedHandle(runId, request, "Model file path is not available.");
  }

  const binary = detection.adapter.executablePath;
  const modelPath = modelState.modelPath;

  const run: AgentRun = {
    id: runId,
    sessionId: request.sessionId,
    adapterId: ADAPTER_ID,
    status: "running",
    prompt: request.prompt,
    startedAt
  };

  let cancelled = false;

  const child = spawn(binary, [
    "--model", modelPath,
    "--ctx-size", "8192",
    "--ngl", getGpuLayers(),
    "--prompt", request.prompt,
    "--no-display-prompt",
    "--single-turn",
    "--simple-io",
    "--log-disable"
  ], {
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderrBuffer = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderrBuffer += chunk.toString("utf8");
  });

  async function* eventStream(): AsyncGenerator<AgentRunEvent> {
    function makeText(text: string): AgentRunEvent {
      return {
        id: `evt-${randomUUID()}`,
        runId,
        type: "text",
        timestamp: new Date().toISOString(),
        payload: { text, streamDelta: true }
      };
    }

    try {
      // llama-cli in --single-turn --simple-io mode writes the banner, then the
      // prompt echo ("> <prompt>\n\n"), then response tokens, then a stats footer
      // ("\n\n[ Prompt: ... ]\n\nExiting...\n") — all on stdout. We buffer until
      // the prompt echo ends, stream response tokens in real-time, then strip the
      // stats footer from the tail.
      const PROMPT_ECHO_SUFFIX = `\n> ${request.prompt}\n\n`;
      const FOOTER_MARKER = "\n\n[ Prompt:";
      const FOOTER_LOOKAHEAD = FOOTER_MARKER.length + 20;
      let headerBuf: string | null = "";
      let tailBuf = "";
      let footerReached = false;

      for await (const chunk of child.stdout!) {
        if (cancelled) break;
        const text = (chunk as Buffer).toString("utf8");
        if (!text) continue;

        if (headerBuf !== null) {
          // Still searching for the end of the prompt echo.
          headerBuf += text;
          const echoEnd = headerBuf.indexOf(PROMPT_ECHO_SUFFIX);
          if (echoEnd !== -1) {
            // Transition: everything after the echo suffix is response content.
            const responseStart = echoEnd + PROMPT_ECHO_SUFFIX.length;
            tailBuf = headerBuf.slice(responseStart);
            headerBuf = null;
          }
          continue;
        }

        if (footerReached) continue; // Drain remaining stdout silently.

        tailBuf += text;
        // Check if the stats footer has arrived.
        const footerIdx = tailBuf.indexOf(FOOTER_MARKER);
        if (footerIdx !== -1) {
          const safe = tailBuf.slice(0, footerIdx);
          tailBuf = "";
          footerReached = true;
          if (safe) yield makeText(safe);
          continue;
        }
        // Yield all but the last FOOTER_LOOKAHEAD bytes (in case the footer
        // marker spans two chunks).
        if (tailBuf.length > FOOTER_LOOKAHEAD) {
          const safe = tailBuf.slice(0, tailBuf.length - FOOTER_LOOKAHEAD);
          tailBuf = tailBuf.slice(tailBuf.length - FOOTER_LOOKAHEAD);
          yield makeText(safe);
        }
      }

      // Flush anything left (strip footer if present).
      if (tailBuf) {
        const footerIdx = tailBuf.indexOf(FOOTER_MARKER);
        const safe = footerIdx !== -1 ? tailBuf.slice(0, footerIdx) : tailBuf;
        if (safe) yield makeText(safe);
      }

      const exitCode = await new Promise<number | null>((resolve) => {
        child.on("close", (code) => resolve(code));
        child.on("error", () => resolve(1));
      });

      if (cancelled) {
        run.status = "canceled";
        run.endedAt = new Date().toISOString();
        yield {
          id: `evt-${randomUUID()}`,
          runId,
          type: "canceled",
          timestamp: run.endedAt,
          payload: {}
        };
        return;
      }

      if (exitCode !== 0) {
        run.status = "failed";
        run.endedAt = new Date().toISOString();
        const message =
          stderrBuffer.trim().slice(0, 2000) || `llama-cli exited with code ${exitCode ?? "unknown"}`;
        yield {
          id: `evt-${randomUUID()}`,
          runId,
          type: "error",
          timestamp: run.endedAt,
          payload: { message }
        };
        return;
      }

      run.status = "completed";
      run.endedAt = new Date().toISOString();
      yield {
        id: `evt-${randomUUID()}`,
        runId,
        type: "completed",
        timestamp: run.endedAt,
        payload: {}
      };
    } catch (error) {
      run.status = "failed";
      run.endedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : "Local inference failed";
      yield {
        id: `evt-${randomUUID()}`,
        runId,
        type: "error",
        timestamp: run.endedAt,
        payload: { message }
      };
    }
  }

  return {
    run,
    events: eventStream(),
    cancel: async () => {
      cancelled = true;
      run.status = "canceled";
      run.endedAt = new Date().toISOString();
      child.kill("SIGTERM");
    }
  };
}

export function createLocalGemmaAdapter(options: LocalGemmaAdapterOptions): AgentAdapterImplementation {
  return {
    id: ADAPTER_ID,
    detect: () => detect(options.getModelState),
    run: (request) => run(request, options.getModelState)
  };
}

export const LOCAL_MODEL_ADAPTER_ID = ADAPTER_ID;
