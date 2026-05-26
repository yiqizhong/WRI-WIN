import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PasteTextConversation, PasteTextMessage } from "@writer/contracts";

import type { DaemonClient } from "../daemon-client";
import { DaemonClientError } from "../daemon-client";
import type { PasteTextAttachmentKind } from "../text-copy-attachment-menu";
import { WELCOME_THINKING_VISIBLE_MS } from "./composer-motion";
import { deriveChatPhase } from "./chat-phase";
import { mergeDisplayMessages, createOptimisticTurn, type OptimisticTurn } from "./optimistic-turn";
import { messageVariantText } from "./message-display";
import { scrollBehaviorForReason, scrollContainerToEnd, type ScrollReason } from "./scroll-intent";
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
  const [localVariantIndexByMessageId, setLocalVariantIndexByMessageId] = useState<
    Record<string, number>
  >({});
  const [optimisticTurn, setOptimisticTurn] = useState<OptimisticTurn | null>(null);
  const [forceWelcome, setForceWelcome] = useState(false);
  const [welcomeSendTransition, setWelcomeSendTransition] = useState(false);
  const [welcomeThinkingVisible, setWelcomeThinkingVisible] = useState(true);

  const threadScrollRef = useRef<HTMLDivElement>(null);
  const composerFooterRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const submittingRef = useRef(false);
  const welcomeSendTransitionRef = useRef(false);
  const welcomeThinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWelcomeThinkingTimer = useCallback(() => {
    if (welcomeThinkingTimerRef.current !== null) {
      window.clearTimeout(welcomeThinkingTimerRef.current);
      welcomeThinkingTimerRef.current = null;
    }
  }, []);

  const revealWelcomeThinking = useCallback(() => {
    clearWelcomeThinkingTimer();
    setWelcomeThinkingVisible(true);
  }, [clearWelcomeThinkingTimer]);

  const scheduleWelcomeThinking = useCallback(() => {
    clearWelcomeThinkingTimer();
    setWelcomeThinkingVisible(false);
    welcomeThinkingTimerRef.current = window.setTimeout(() => {
      welcomeThinkingTimerRef.current = null;
      setWelcomeThinkingVisible(true);
    }, WELCOME_THINKING_VISIBLE_MS);
  }, [clearWelcomeThinkingTimer]);

  const displayMessages = useMemo(
    () =>
      mergeDisplayMessages(conversation, optimisticTurn, {
        preserveOptimisticUser: welcomeSendTransition
      }),
    [conversation, optimisticTurn, welcomeSendTransition]
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
    const behavior = scrollBehaviorForReason(reason);
    const run = () => {
      const container = threadScrollRef.current;
      if (!container) {
        return;
      }
      scrollContainerToEnd(container, behavior);
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, []);

  useEffect(() => {
    const container = threadScrollRef.current;
    if (!container || phase !== "active") {
      return;
    }

    const onScroll = () => {
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
      stickToBottomRef.current = distance <= 80;
    };

    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [phase]);

  useLayoutEffect(() => {
    if (phase !== "active" || welcomeSendTransition) {
      return;
    }
    scrollToEnd("phase-active");
  }, [phase, scrollToEnd, welcomeSendTransition]);

  useLayoutEffect(() => {
    if (phase !== "active") {
      return;
    }
    const container = threadScrollRef.current;
    if (welcomeSendTransition) {
      if (container) {
        container.scrollTop = 0;
      }
      return;
    }
    if (pendingAssistant || stickToBottomRef.current) {
      scrollToEnd(pendingAssistant ? "stream" : "message");
    }
  }, [displayMessages, phase, pendingAssistant, scrollToEnd, streamingText, welcomeSendTransition]);

  useLayoutEffect(() => {
    if (phase !== "active" || !streamingText || welcomeSendTransition) {
      return;
    }
    scrollToEnd("stream");
  }, [phase, scrollToEnd, streamingText, welcomeSendTransition]);

  useEffect(() => {
    if (phase !== "active") {
      return;
    }

    const footer = composerFooterRef.current;
    if (!footer) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (welcomeSendTransition || !stickToBottomRef.current) {
        return;
      }
      scrollToEnd("message");
    });
    observer.observe(footer);
    return () => observer.disconnect();
  }, [phase, scrollToEnd, welcomeSendTransition]);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    welcomeSendTransitionRef.current = welcomeSendTransition;
  }, [welcomeSendTransition]);

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
      setDraftText("");
      setForceWelcome(false);
      const fromWelcome = phase === "welcome";
      if (fromWelcome) {
        welcomeSendTransitionRef.current = true;
        setWelcomeSendTransition(true);
        scheduleWelcomeThinking();
        stickToBottomRef.current = false;
      } else {
        stickToBottomRef.current = true;
      }
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

        onConversationChange(result.conversation);
        if (!fromWelcome || !welcomeSendTransitionRef.current) {
          setOptimisticTurn(null);
        }
        if (!fromWelcome) {
          scrollToEnd("send");
        }
      } catch (err) {
        setDraftText(text);
        setOptimisticTurn(null);
        welcomeSendTransitionRef.current = false;
        setWelcomeSendTransition(false);
        revealWelcomeThinking();
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
      phase,
      revealWelcomeThinking,
      rowIndex,
      scheduleWelcomeThinking,
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
    welcomeSendTransitionRef.current = false;
    setWelcomeSendTransition(false);
    revealWelcomeThinking();
    setDraftText("");
    setError(null);
    stickToBottomRef.current = true;
  }, [revealWelcomeThinking]);

  const completeWelcomeSendTransition = useCallback(() => {
    welcomeSendTransitionRef.current = false;
    setWelcomeSendTransition(false);
    revealWelcomeThinking();
    if (!submittingRef.current) {
      setOptimisticTurn(null);
    }
    stickToBottomRef.current = true;
    scrollToEnd("message");
  }, [revealWelcomeThinking, scrollToEnd]);

  useEffect(() => () => clearWelcomeThinkingTimer(), [clearWelcomeThinkingTimer]);

  const resolveMessageVariantIndex = useCallback(
    (message: PasteTextMessage) => {
      const local = localVariantIndexByMessageId[message.id];
      if (local !== undefined) {
        return local;
      }

      if (message.variantIndex !== undefined) {
        return message.variantIndex;
      }

      const count = message.variants?.length ?? 0;
      return count > 0 ? count - 1 : 0;
    },
    [localVariantIndexByMessageId]
  );

  const setMessageVariantIndex = useCallback((messageId: string, index: number) => {
    setLocalVariantIndexByMessageId((current) => ({
      ...current,
      [messageId]: index
    }));
  }, []);

  const copySuggestion = useCallback(
    async (message: PasteTextMessage, variantIndex?: number) => {
      const text = messageVariantText(message, variantIndex ?? resolveMessageVariantIndex(message));
      await navigator.clipboard.writeText(text);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    },
    [resolveMessageVariantIndex]
  );

  const regenerateAssistant = useCallback(
    async (assistantMessageId: string) => {
      if (!conversation?.id || !daemonConnected || !workspaceReady || pendingRewrite) {
        return;
      }

      setError(null);

      try {
        const updated = await client.regeneratePasteTextAssistantMessage(
          conversation.id,
          assistantMessageId
        );
        setLocalVariantIndexByMessageId((current) => {
          const next = { ...current };
          delete next[assistantMessageId];
          return next;
        });
        onConversationChange(updated);
        scrollToEnd("send");
      } catch (err) {
        setError(
          err instanceof DaemonClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not regenerate suggestion."
        );
      }
    },
    [
      client,
      conversation?.id,
      daemonConnected,
      onConversationChange,
      pendingRewrite,
      scrollToEnd,
      workspaceReady
    ]
  );

  const composerSendDisabled =
    !workspaceReady || !daemonConnected || submitting || pendingRewrite;

  return {
    phase,
    welcomeSendTransition,
    welcomeThinkingVisible,
    completeWelcomeSendTransition,
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
    composerFooterRef,
    messagesEndRef,
    conversation,
    isStructured: conversation?.inputMode === "structured_file",
    attachment: conversation?.attachment,
    composerSendDisabled,
    sendMessage,
    attachFile,
    resetToWelcome,
    copySuggestion,
    regenerateAssistant,
    resolveMessageVariantIndex,
    setMessageVariantIndex
  };
}
