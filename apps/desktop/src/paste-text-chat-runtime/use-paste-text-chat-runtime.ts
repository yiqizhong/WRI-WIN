import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PasteTextConversation, PasteTextMessage } from "@writer/contracts";

import type { DaemonClient } from "../daemon-client";
import { DaemonClientError } from "../daemon-client";
import type { PasteTextAttachmentKind } from "../text-copy-attachment-menu";
import { deriveChatPhase } from "./chat-phase";
import { mergeDisplayMessages, createOptimisticTurn, type OptimisticTurn } from "./optimistic-turn";
import {
  createScrollThrottle,
  isNearBottom,
  scrollBehaviorForReason,
  type ScrollReason
} from "./scroll-intent";
import { usePasteTextRunSync } from "./use-paste-text-run-sync";

type UsePasteTextChatRuntimeInput = {
  client: DaemonClient;
  daemonConnected: boolean;
  workspaceReady: boolean;
  projectId: string;
  productId?: string;
  conversation: PasteTextConversation | null;
  onConversationChange: (conversation: PasteTextConversation | null) => void;
};

export function usePasteTextChatRuntime({
  client,
  daemonConnected,
  workspaceReady,
  projectId,
  productId,
  conversation,
  onConversationChange
}: UsePasteTextChatRuntimeInput) {
  const [draftText, setDraftText] = useState("");
  const [rowIndex, setRowIndex] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [optimisticTurn, setOptimisticTurn] = useState<OptimisticTurn | null>(null);
  const [forceWelcome, setForceWelcome] = useState(false);

  const threadScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollThrottleRef = useRef(createScrollThrottle(300));

  const displayMessages = useMemo(
    () => mergeDisplayMessages(conversation, optimisticTurn),
    [conversation, optimisticTurn]
  );

  const phase = deriveChatPhase({
    serverMessages: conversation?.messages ?? [],
    optimisticTurn,
    forceWelcome
  });

  const pendingAssistant = useMemo(
    () => displayMessages.find((message) => message.role === "assistant" && message.status === "pending"),
    [displayMessages]
  );

  const pendingRewrite = Boolean(pendingAssistant);

  const handleRunSyncConversationChange = useCallback(
    (fresh: PasteTextConversation) => {
      setOptimisticTurn(null);
      onConversationChange(fresh);
    },
    [onConversationChange]
  );

  const { streamingText, runStatus, runEvents } = usePasteTextRunSync({
    client,
    conversation,
    pendingAssistant,
    onConversationChange: handleRunSyncConversationChange
  });

  const scrollToEnd = useCallback((reason: ScrollReason) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: scrollBehaviorForReason(reason)
    });
  }, []);

  useEffect(() => {
    if (phase !== "active") {
      return;
    }
    scrollToEnd("phase-active");
  }, [phase, scrollToEnd]);

  useEffect(() => {
    if (phase !== "active") {
      return;
    }
    scrollToEnd("message");
  }, [displayMessages.length, phase, scrollToEnd]);

  useEffect(() => {
    if (phase !== "active" || !streamingText) {
      return;
    }

    const container = threadScrollRef.current;
    if (container && !isNearBottom(container)) {
      return;
    }

    if (!scrollThrottleRef.current.shouldScroll()) {
      return;
    }

    scrollToEnd("stream");
  }, [phase, scrollToEnd, streamingText]);

  useEffect(() => {
    if (!conversation) {
      setOptimisticTurn(null);
      setForceWelcome(false);
    }
  }, [conversation]);

  const ensureConversation = useCallback(async (): Promise<PasteTextConversation> => {
    if (conversation) {
      return conversation;
    }

    const created = await client.createPasteTextConversation({
      projectId,
      ...(productId ? { productId } : {})
    });
    onConversationChange(created);
    return created;
  }, [client, conversation, onConversationChange, productId, projectId]);

  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? draftText).trim();
      if (!text || !daemonConnected || !workspaceReady || submitting || pendingRewrite) {
        return;
      }

      setSubmitting(true);
      setError(null);
      setForceWelcome(false);
      setOptimisticTurn(createOptimisticTurn(text));

      try {
        const current = await ensureConversation();
        const structured = current.inputMode === "structured_file";
        const parsedRowIndex =
          structured && rowIndex.trim() !== "" ? Number.parseInt(rowIndex, 10) : undefined;

        const result = await client.sendPasteTextMessage(current.id, {
          text,
          rowIndex: Number.isNaN(parsedRowIndex) ? undefined : parsedRowIndex
        });

        setOptimisticTurn(null);
        onConversationChange(result.conversation);
        setDraftText("");
        scrollToEnd("send");
      } catch (err) {
        setOptimisticTurn(null);
        setError(
          err instanceof DaemonClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not send message."
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      client,
      daemonConnected,
      draftText,
      ensureConversation,
      onConversationChange,
      pendingRewrite,
      rowIndex,
      scrollToEnd,
      submitting,
      workspaceReady
    ]
  );

  const attachFile = useCallback(
    async (kind: PasteTextAttachmentKind) => {
      if (!daemonConnected || !workspaceReady) {
        return;
      }

      const filePath = await window.writerDesktop.pickPasteTextAttachment(kind);
      if (!filePath) {
        return;
      }

      setAttaching(true);
      setError(null);

      try {
        const current = await ensureConversation();
        const updated = await client.attachPasteTextFile({
          conversationId: current.id,
          filePath
        });
        onConversationChange(updated);
      } catch (err) {
        setError(
          err instanceof DaemonClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not attach file."
        );
      } finally {
        setAttaching(false);
      }
    },
    [client, daemonConnected, ensureConversation, onConversationChange, workspaceReady]
  );

  const resetToWelcome = useCallback(() => {
    setOptimisticTurn(null);
    setForceWelcome(true);
    setDraftText("");
    setError(null);
    scrollThrottleRef.current.reset();
  }, []);

  const copySuggestion = useCallback(async (message: PasteTextMessage) => {
    const text = message.suggestedText ?? message.text;
    await navigator.clipboard.writeText(text);
    setCopiedId(message.id);
    window.setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const composerSendDisabled =
    !workspaceReady || !daemonConnected || submitting || pendingRewrite;

  return {
    phase,
    draftText,
    setDraftText,
    rowIndex,
    setRowIndex,
    error,
    setError,
    copiedId,
    displayMessages,
    pendingAssistant,
    pendingRewrite,
    submitting,
    attaching,
    streamingText,
    runStatus,
    runEvents,
    threadScrollRef,
    messagesEndRef,
    conversation,
    isStructured: conversation?.inputMode === "structured_file",
    attachment: conversation?.attachment,
    composerSendDisabled,
    sendMessage,
    attachFile,
    resetToWelcome,
    copySuggestion
  };
}
