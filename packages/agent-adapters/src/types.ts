import type { AgentAdapter, AgentRun, AgentRunEvent } from "@writer/contracts";

export type AgentDetectionResult = {
  adapter: AgentAdapter;
};

export type AgentRunRequest = {
  sessionId: string;
  prompt: string;
};

export type AgentRunHandle = {
  run: AgentRun;
  events: AsyncIterable<AgentRunEvent>;
  cancel: () => Promise<void>;
};

export type AgentAdapterImplementation = {
  id: string;
  detect: () => Promise<AgentDetectionResult>;
  run: (request: AgentRunRequest) => Promise<AgentRunHandle>;
};
