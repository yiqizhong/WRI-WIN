import type { PasteTextConversation, PasteTextMessage } from "@writer/contracts";

export type OptimisticTurn = {
  userMessage: PasteTextMessage;
  assistantMessage: PasteTextMessage;
};

type MergeDisplayMessagesOptions = {
  preserveOptimisticUser?: boolean;
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
  optimisticTurn: OptimisticTurn | null,
  options: MergeDisplayMessagesOptions = {}
): PasteTextMessage[] {
  const server = (conversation?.messages ?? []).filter(
    (message) => !isOptimisticMessageId(message.id)
  );

  if (!optimisticTurn) {
    return server;
  }

  const lastUserIndex = lastIndexOfUserMessage(server);
  const lastUser = lastUserIndex >= 0 ? server[lastUserIndex] : undefined;
  if (lastUser?.text === optimisticTurn.userMessage.text) {
    if (options.preserveOptimisticUser) {
      const preserved = [...server];
      preserved[lastUserIndex] = optimisticTurn.userMessage;
      const hasAssistantAfterUser = preserved
        .slice(lastUserIndex + 1)
        .some((message) => message.role === "assistant");

      return hasAssistantAfterUser
        ? preserved
        : [...preserved, optimisticTurn.assistantMessage];
    }

    return server;
  }

  return [...server, optimisticTurn.userMessage, optimisticTurn.assistantMessage];
}

function lastIndexOfUserMessage(messages: PasteTextMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      return index;
    }
  }
  return -1;
}
