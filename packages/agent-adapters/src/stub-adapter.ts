import type { AgentAdapter, AgentRun, AgentRunEvent } from "@writer/contracts";

import type { AgentAdapterImplementation, AgentDetectionResult, AgentRunHandle, AgentRunRequest } from "./types";

export function createStubAdapter(id: string, displayName: string): AgentAdapterImplementation {
  return {
    id,
    async detect(): Promise<AgentDetectionResult> {
      const adapter: AgentAdapter = {
        id,
        displayName,
        available: false,
        setupMessage: `${displayName} CLI is not configured yet.`,
        capabilities: [{ id: "review", label: "UX copy review", enabled: false }]
      };

      return { adapter };
    },

    async run(request: AgentRunRequest): Promise<AgentRunHandle> {
      const startedAt = new Date().toISOString();
      const run: AgentRun = {
        id: `run-${id}-${Date.now()}`,
        sessionId: request.sessionId,
        adapterId: id,
        status: "failed",
        prompt: request.prompt,
        startedAt,
        endedAt: startedAt
      };

      const event: AgentRunEvent = {
        id: `evt-${run.id}`,
        runId: run.id,
        type: "error",
        timestamp: startedAt,
        payload: {
          message: `${displayName} adapter is not available yet.`
        }
      };

      async function* events() {
        yield event;
      }

      return {
        run,
        events: events(),
        cancel: async () => undefined
      };
    }
  };
}
