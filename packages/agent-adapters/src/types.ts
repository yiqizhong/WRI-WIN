import type { AgentAdapter, AgentRun, AgentRunEvent } from "@writer/contracts";

export type AgentDetectionResult = {
  adapter: AgentAdapter;
};

/**
 * `force: true` bypasses the detection cache. Used for the explicit
 * "Refresh detection" affordance in the UI. Default false — every other
 * call site (run launches, list reads) goes through the TTL cache, which
 * is the main lever for cutting TTFT from cold-spawned CLI adapters.
 */
export type DetectOptions = {
  force?: boolean;
};

export type AgentRunRequest = {
  sessionId: string;
  prompt: string;
  reasoning?: boolean;
};

export type AgentRunHandle = {
  run: AgentRun;
  events: AsyncIterable<AgentRunEvent>;
  cancel: () => Promise<void>;
};

export type AgentAdapterImplementation = {
  id: string;
  detect: (options?: DetectOptions) => Promise<AgentDetectionResult>;
  run: (request: AgentRunRequest) => Promise<AgentRunHandle>;
};
