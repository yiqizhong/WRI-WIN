import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";

import type { AgentAdapter, AgentRun, AgentRunEvent } from "@writer/contracts";

import type { AgentAdapterImplementation, AgentDetectionResult, AgentRunHandle, AgentRunRequest } from "./types";

const ECHO_PATH = "/bin/echo";

export function createEchoAdapter(): AgentAdapterImplementation {
  return {
    id: "echo",
    detect: detectEcho,
    run: runEcho
  };
}

async function detectEcho(): Promise<AgentDetectionResult> {
  let available = false;

  try {
    await access(ECHO_PATH, constants.X_OK);
    available = true;
  } catch {
    available = false;
  }

  const adapter: AgentAdapter = {
    id: "echo",
    displayName: "Echo (dev)",
    available,
    executablePath: available ? ECHO_PATH : undefined,
    setupMessage: available ? undefined : "Echo is not available on this system.",
    capabilities: [{ id: "review", label: "UX copy review", enabled: available }]
  };

  return { adapter };
}

async function runEcho(request: AgentRunRequest): Promise<AgentRunHandle> {
  const startedAt = new Date().toISOString();
  const runId = `run-echo-${Date.now()}`;
  const run: AgentRun = {
    id: runId,
    sessionId: request.sessionId,
    adapterId: "echo",
    status: "running",
    startedAt
  };

  const child = spawn(ECHO_PATH, [request.prompt], { stdio: ["ignore", "pipe", "pipe"] });
  const events: AgentRunEvent[] = [];
  let cancelled = false;

  const textPromise = new Promise<string>((resolve, reject) => {
    let stdout = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (cancelled) {
        resolve(stdout);
        return;
      }

      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Echo exited with code ${code ?? "unknown"}`));
      }
    });
  });

  async function* eventStream(): AsyncGenerator<AgentRunEvent> {
    try {
      const text = await textPromise;

      if (cancelled) {
        yield {
          id: `evt-${runId}-canceled`,
          runId,
          type: "canceled",
          timestamp: run.endedAt ?? new Date().toISOString(),
          payload: {}
        };
        return;
      }

      if (!cancelled) {
        const event: AgentRunEvent = {
          id: `evt-${runId}-text`,
          runId,
          type: "text",
          timestamp: new Date().toISOString(),
          payload: { text }
        };
        events.push(event);
        yield event;

        run.status = "completed";
        run.endedAt = new Date().toISOString();
        yield {
          id: `evt-${runId}-done`,
          runId,
          type: "completed",
          timestamp: run.endedAt,
          payload: {}
        };
      }
    } catch (error) {
      run.status = "failed";
      run.endedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : "Echo run failed";
      yield {
        id: `evt-${runId}-error`,
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
