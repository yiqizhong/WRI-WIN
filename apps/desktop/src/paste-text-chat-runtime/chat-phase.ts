import type { PasteTextMessage } from "@writer/contracts";

import type { OptimisticTurn } from "./optimistic-turn";

export type ChatPhase = "welcome" | "active";

export function deriveChatPhase(input: {
  serverMessages: PasteTextMessage[];
  optimisticTurn: OptimisticTurn | null;
  forceWelcome?: boolean;
}): ChatPhase {
  if (input.forceWelcome) {
    return "welcome";
  }

  if (input.optimisticTurn) {
    return "active";
  }

  if (input.serverMessages.some((message) => message.role === "user")) {
    return "active";
  }

  return "welcome";
}
