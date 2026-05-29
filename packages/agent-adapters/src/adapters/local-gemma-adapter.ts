import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { dirname, join } from "node:path";

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

// Extracts the model's response from llama-cli's full stdout.
// Strips: the startup banner (everything up to and including the prompt-echo
// line "> <prompt>"), any "[Start thinking]...[End thinking]" reasoning block,
// and the trailing stats footer ("[ Prompt: ... t/s ]" / "Exiting...").
// Handles both CRLF and LF line endings.
export function extractResponse(raw: string, prompt: string): string {
  let text = raw.replace(/\r\n/g, "\n");

  // Drop everything through the prompt-echo line. The echo is "> <prompt>" on its
  // own line; match by the first line that starts with "> " and contains the
  // prompt's first line (prompts may be multi-line).
  const promptHead = prompt.split("\n")[0]!.trim();
  const echoIdx = text.indexOf(`> ${promptHead}`);
  if (echoIdx !== -1) {
    const afterEcho = text.indexOf("\n", echoIdx);
    if (afterEcho !== -1) text = text.slice(afterEcho + 1);
  }

  // Remove a thinking/reasoning block if present.
  text = text.replace(/\[Start thinking\][\s\S]*?\[End thinking\]\s*/i, "");
  // Some builds open the block but the footer arrives before a matching close.
  text = text.replace(/\[Start thinking\][\s\S]*$/i, "");

  // Strip the stats footer and anything after it.
  const footerIdx = text.search(/\[ Prompt:|\nExiting\.\.\./);
  if (footerIdx !== -1) text = text.slice(0, footerIdx);

  return text.trim();
}

// Asks llama-cli which compute devices it can actually load. This is stronger
// than `nvidia-smi`: it exercises the exact backend path inference will use, so
// it catches a present-but-unloadable CUDA backend (e.g. ggml-cuda.dll missing
// its cudart/cublas runtime dependencies), which would otherwise silently fall
// back to CPU.
//
// Returns the list of non-CPU device descriptions reported by llama-cli.
// WRITER_GPU_LAYERS="0" disables GPU enforcement entirely (dev / CI without GPU).
async function listGpuDevices(binaryPath: string): Promise<string[]> {
  return new Promise((resolve) => {
    let stdout = "";
    const child = spawn(binaryPath, ["--list-devices"], {
      cwd: dirname(binaryPath),
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true
    } as Parameters<typeof spawn>[2]);
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.on("error", () => resolve([]));
    child.on("close", () => {
      // Output format:
      //   Available devices:
      //     CUDA0: NVIDIA RTX ... (12288 MiB, 12000 MiB free)
      // A CPU-only build prints "Available devices:" with nothing after it.
      const lines = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !/^Available devices:?$/i.test(line));
      // Keep only entries that look like accelerator devices (CUDA/Vulkan/etc),
      // never a "CPU" pseudo-device some builds emit.
      const gpu = lines.filter((line) => !/^CPU\b/i.test(line));
      resolve(gpu);
    });
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
    const gpuDevices = await listGpuDevices(binaryPath);
    if (gpuDevices.length === 0) {
      return buildAdapter({
        available: false,
        setupMessage:
          "NVIDIA GPU backend could not load, so inference would run on CPU. " +
          "Most likely the CUDA 12 runtime is missing: place cudart64_12.dll, " +
          "cublas64_12.dll, and cublasLt64_12.dll next to llama-cli.exe (or install " +
          "the CUDA 12 Toolkit). Set WRITER_GPU_LAYERS=0 to allow CPU inference.",
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

  // Set cwd to the binary's directory so Windows finds ggml-cuda.dll and
  // other sibling DLLs at process load time via the standard DLL search order.
  const child = spawn(binary, [
    "--model", modelPath,
    "--ctx-size", "8192",
    "-ngl", getGpuLayers(),
    "--prompt", request.prompt,
    "--no-display-prompt",
    "--single-turn",
    "--simple-io",
    "--log-disable"
  ], {
    cwd: dirname(binary),
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
      // llama-cli writes a startup banner, the prompt echo line ("> <prompt>"),
      // optionally a "[Start thinking]...[End thinking]" reasoning block, the
      // response, and a stats footer ("[ Prompt: ... t/s ]\nExiting...") — all on
      // stdout, with CRLF line endings on Windows.
      //
      // The previous streaming parser matched a literal "\n> <prompt>\n\n" suffix,
      // which never matched under CRLF, so it buffered forever and emitted nothing.
      // We instead buffer the full stdout and extract the response once at the end.
      // The model is fast (~58 tok/s) and responses are short, so the latency cost
      // of not streaming is acceptable and the parser is far more robust.
      let raw = "";
      for await (const chunk of child.stdout!) {
        if (cancelled) break;
        raw += (chunk as Buffer).toString("utf8");
      }

      const response = extractResponse(raw, request.prompt);
      if (response) yield makeText(response);

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
