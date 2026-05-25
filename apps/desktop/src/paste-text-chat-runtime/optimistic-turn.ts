import type { PasteTextConversation, PasteTextMessage } from "@writer/contracts";

export type OptimisticTurn = {
  userMessage: PasteTextMessage;
  assistantMessage: PasteTextMessage;
};

const OPTIMISTIC_PREFIX = "optimistic-";

export function isOptimisticMessageId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_PREFIX);
}

export function createOptimisticTurn(userText: string): OptimisticTurn {
  const createdAt = new Date().toISOString();
  const stamp = `${Date.now()}`;

  return {
    userMessage: {
      id: `${OPTIMISTIC_PREFIX}user-${stamp}`,
      role: "user",
      text: userText,
      createdAt
    },
    assistantMessage: {
      id: `${OPTIMISTIC_PREFIX}assistant-${stamp}`,
      role: "assistant",
      text: "",
      status: "pending",
      createdAt
    }
  };
}

export function mergeDisplayMessages(
  conversation: PasteTextConversation | null,
  optimisticTurn: OptimisticTurn | null
): PasteTextMessage[] {
  const server = (conversation?.messages ?? []).filter(
    (message) => !isOptimisticMessageId(message.id)
  );

  if (!optimisticTurn) {
    return server;
  }

  const lastUser = server.filter((message) => message.role === "user").at(-1);
  if (lastUser?.text === optimisticTurn.userMessage.text) {
    return server;
  }

  return [...server, optimisticTurn.userMessage, optimisticTurn.assistantMessage];
}
