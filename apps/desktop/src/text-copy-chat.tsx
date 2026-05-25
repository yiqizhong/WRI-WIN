import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy } from "lucide-react";
import type { AgentRunEvent, PasteTextConversation, PasteTextMessage } from "@writer/contracts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InlineAlert } from "@/components/writer/inline-alert";

import type { DaemonClient } from "./daemon-client";
import { DaemonClientError } from "./daemon-client";
import { chatBubble, chatBubbleEnd, hugWidth, stackFill } from "./layout/writer-sizing";
import { TextCopyAttachmentMenu, type PasteTextAttachmentKind } from "./text-copy-attachment-menu";
import { TextCopyThinkingRibbonView } from "./text-copy-thinking-ribbon-view";

const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "canceled"]);

function streamingTextFromEvents(events: AgentRunEvent[]): string {
  const textEvents = events.filter(
    (event) => event.type === "text" && event.payload?.streamFinal !== true
  );
  const hasDeltas = textEvents.some((event) => event.payload?.streamDelta === true);

  return textEvents
    .map((event) => String(event.payload?.text ?? ""))
    .filter(Boolean)
    .join(hasDeltas ? "" : "\n");
}

function messagePreview(message: PasteTextMessage, streamingText?: string | null): string {
  if (message.status === "pending") {
    if (streamingText) {
      return streamingText;
    }

    return "Rewriting…";
  }

  if (message.status === "failed") {
    return message.errorMessage ?? message.text;
  }

  if (message.role === "assistant") {
    return message.suggestedText ?? message.text;
  }

  return message.text;
}

type TextCopyChatProps = {
  client: DaemonClient;
  daemonConnected: boolean;
  workspaceReady: boolean;
  projectId: string;
  productId?: string;
  productName: string;
  conversation: PasteTextConversation | null;
  onConversationChange: (conversation: PasteTextConversation | null) => void;
  onRequestNewConversation: () => void;
};

export function TextCopyChat({
  client,
  daemonConnected,
  workspaceReady,
  projectId,
  productId,
  productName,
  conversation,
  onConversationChange,
  onRequestNewConversation
}: TextCopyChatProps) {
  const [draftText, setDraftText] = useState("");
  const [rowIndex, setRowIndex] = useState("0");
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string | undefined>();
  const [runEvents, setRunEvents] = useState<AgentRunEvent[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const pendingAssistant = useMemo(
    () => conversation?.messages.find((message) => message.role === "assistant" && message.status === "pending"),
    [conversation?.messages]
  );

  const isStructured = conversation?.inputMode === "structured_file";
  const attachment = conversation?.attachment;
  const pendingRewrite = Boolean(pendingAssistant);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length, sending, streamingText]);

  useEffect(() => {
    if (!conversation?.id || !pendingAssistant) {
      setStreamingText(null);
      setRunStatus(undefined);
      setRunEvents([]);
      return;
    }

    let cancelled = false;
    const messageId = pendingAssistant.id;
    let runId = pendingAssistant.agentRunId;

    const poll = async () => {
      try {
        const fresh = await client.getPasteTextConversation(conversation.id);
        if (cancelled) {
          return;
        }

        const assistant = fresh.messages.find((message) => message.id === messageId);

        if (!assistant || assistant.status !== "pending") {
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
        const text = streamingTextFromEvents(detail.events);
        setStreamingText(text || null);

        if (TERMINAL_RUN_STATUSES.has(detail.run.status)) {
          const completed = await client.getPasteTextConversation(conversation.id);
          if (!cancelled) {
            onConversationChange(completed);
            setStreamingText(null);
            setRunStatus(undefined);
            setRunEvents([]);
          }
        }
      } catch {
        // Keep polling.
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 100);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [client, conversation?.id, onConversationChange, pendingAssistant?.agentRunId, pendingAssistant?.id]);

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

  async function handleSend() {
    const text = draftText.trim();
    if (!text || !daemonConnected || !workspaceReady) {
      return;
    }

    setSending(true);
    setError(null);
    setStreamingText(null);

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
      setDraftText("");
    } catch (err) {
      setError(
        err instanceof DaemonClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not send message."
      );
    } finally {
      setSending(false);
    }
  }

  async function handleAttach(kind: PasteTextAttachmentKind) {
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
  }

  async function copySuggestion(message: PasteTextMessage) {
    const text = message.suggestedText ?? message.text;
    await navigator.clipboard.writeText(text);
    setCopiedId(message.id);
    window.setTimeout(() => setCopiedId(null), 2000);
  }

  const composerDisabled = !workspaceReady || !daemonConnected || sending || pendingRewrite;

  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-5 ${stackFill}`}>
      <div className="flex shrink-0 items-center justify-between gap-3">
        <p className="writer-type-helper">Auditing {productName}</p>
        {conversation ? (
          <Button variant="ghost" size="sm" className={hugWidth} onClick={onRequestNewConversation}>
            New conversation
          </Button>
        ) : null}
      </div>

      {!daemonConnected ? (
        <InlineAlert
          kind="warning"
          title="Daemon disconnected"
          subtitle="Start the Writer daemon to send messages and attach files."
        />
      ) : null}

      {attachment ? (
        <p className="writer-type-helper">
          Attached: {attachment.fileName}
          {isStructured ? " · structured file mode" : " · plain text file"}
        </p>
      ) : null}

      {isStructured ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="text-copy-row-index">Row index</Label>
          <p className="text-sm text-muted-foreground">0-based row to rewrite.</p>
          <Input
            id="text-copy-row-index"
            value={rowIndex}
            onChange={(event) => setRowIndex(event.target.value)}
            className={`${hugWidth} writer-row-index-input`}
          />
        </div>
      ) : null}

      <div className="writer-chat-scroll min-h-0 flex-1">
        {conversation?.messages.length ? (
          <div className="flex flex-col gap-5">
            {conversation.messages.map((message) => {
              const isAssistant = message.role === "assistant";
              const isPending = message.status === "pending";
              const isFailed = message.status === "failed";
              const showStream = isPending && message.id === pendingAssistant?.id;
              const body = messagePreview(message, showStream ? streamingText : null);
              const showCursor = showStream && Boolean(streamingText);

              return (
                <div
                  key={message.id}
                  className={`flex flex-col gap-3 ${isAssistant ? chatBubble : chatBubbleEnd}`}
                >
                  <span className="writer-type-eyebrow">
                    {isAssistant ? (isPending ? "Rewriting" : isFailed ? "Failed" : "Suggestion") : "You"}
                  </span>
                  <div
                    className={
                      "writer-chat-message" +
                      (isAssistant ? " writer-chat-message--assistant" : " writer-chat-message--user") +
                      (isFailed ? " writer-chat-message--failed" : "") +
                      (isPending && !streamingText ? " writer-chat-message--placeholder" : "")
                    }
                  >
                    {isPending && message.id === pendingAssistant?.id && !streamingText ? (
                      <TextCopyThinkingRibbonView
                        runStatus={runStatus}
                        events={runEvents}
                        assistantFailed={isFailed}
                      />
                    ) : (
                      <>
                        {body}
                        {showCursor ? "▍" : null}
                      </>
                    )}
                  </div>
                  {isAssistant && !isPending && !isFailed ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={hugWidth}
                      onClick={() => void copySuggestion(message)}
                    >
                      <Copy className="size-4" />
                      {copiedId === message.id ? "Copied" : "Copy suggestion"}
                    </Button>
                  ) : null}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <p className="writer-type-body-compact writer-text-secondary">Paste copy below to start rewriting.</p>
        )}
      </div>

      {error ? (
        <InlineAlert kind="error" title="Send failed" subtitle={error} onClose={() => setError(null)} />
      ) : null}

      <div className="writer-composer-row shrink-0">
        <TextCopyAttachmentMenu
          disabled={composerDisabled || attaching}
          attaching={attaching}
          onAttach={(kind) => void handleAttach(kind)}
        />
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="text-copy-composer">Copy to rewrite</Label>
          <Textarea
            id="text-copy-composer"
            className="writer-composer-input"
            placeholder="Paste copy and send…"
            rows={3}
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            disabled={composerDisabled}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void handleSend();
              }
            }}
          />
        </div>
        <Button disabled={composerDisabled || !draftText.trim()} onClick={() => void handleSend()}>
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
