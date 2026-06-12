import { useEffect, useState } from "react";
import type { AgentRunEvent, PasteTextConversation, PasteTextMessage } from "@writer/contracts";

import type { DaemonClient } from "../daemon-client";
import { createRunPoller } from "../lib/create-run-poller";
import { isOptimisticMessageId } from "./optimistic-turn";
import { isTerminalRunStatus, RUN_POLL_INTERVAL_MS, streamingTextFromEvents } from "./message-display";

type UsePasteTextRunSyncInput = {
  client: DaemonClient;
  conversation: PasteTextConversation | null;
  pendingAssistant: PasteTextMessage | undefined;
  onConversationChange: (conversation: PasteTextConversation) => void;
};

export function usePasteTextRunSync({
  client,
  conversation,
  pendingAssistant,
  onConversationChange
}: UsePasteTextRunSyncInput) {
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string | undefined>();
  const [runEvents, setRunEvents] = useState<AgentRunEvent[]>([]);

  useEffect(() => {
    if (!conversation?.id || !shouldPollPendingAssistant(pendingAssistant)) {
      setStreamingText(null);
      setRunStatus(undefined);
      setRunEvents([]);
      return;
    }

    let cancelled = false;
    const conversationId = conversation.id;
    const messageId = pendingAssistant.id;
    let runId = pendingAssistant.agentRunId;

    const poll = async () => {
      try {
        const fresh = await client.getPasteTextConversation(conversationId);
        if (cancelled || fresh.id !== conversationId) {
          return;
        }

        const assistant = fresh.messages.find((message) => message.id === messageId);

        if (!assistant || assistant.status !== "pending") {
          console.log("[usePasteTextRunSync] early delivery (non-pending)", {
            messageId,
            assistantStatus: assistant?.status,
            variantsLength: assistant?.variants?.length,
            variantIndex: assistant?.variantIndex
          });
          onConversationChange(fresh);
          setStreamingText(null);
          setRunStatus(undefined);
          setRunEvents([]);
          return;
        }

        if (!runId && assistant.agentRunId) {
          runId = assistant.agentRunId;
          onConversationChange(fresh);
        }

        if (!runId) {
          return;
        }

        const detail = await client.getAgentRun(runId);
        if (cancelled) {
          return;
        }

        setRunStatus(detail.run.status);
        setRunEvents(detail.events);
        setStreamingText(streamingTextFromEvents(detail.events) || null);

        if (isTerminalRunStatus(detail.run.status)) {
          const completed = await client.getPasteTextConversation(conversationId);
          if (!cancelled && completed.id === conversationId) {
            const completedAssistant = completed.messages.find((m) => m.id === messageId);
            console.log("[usePasteTextRunSync] terminal delivery", {
              messageId,
              assistantStatus: completedAssistant?.status,
              variantsLength: completedAssistant?.variants?.length,
              variantIndex: completedAssistant?.variantIndex
            });
            // If finishPasteTextRewrite hasn't committed yet the message is
            // still "pending". Skip delivery and let the poller tick again —
            // the early-exit path will fire once the store is updated.
            if (!completedAssistant || completedAssistant.status !== "pending") {
              onConversationChange(completed);
              setStreamingText(null);
              setRunStatus(undefined);
              setRunEvents([]);
            }
          }
        }
      } catch {
        // Keep polling.
      }
    };

    const stop = createRunPoller(poll, RUN_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      stop();
    };
  }, [client, conversation?.id, onConversationChange, pendingAssistant?.agentRunId, pendingAssistant?.id]);

  return { streamingText, runStatus, runEvents };
}

export function shouldPollPendingAssistant(
  pendingAssistant: PasteTextMessage | undefined
): pendingAssistant is PasteTextMessage {
  return Boolean(pendingAssistant && !isOptimisticMessageId(pendingAssistant.id));
}
