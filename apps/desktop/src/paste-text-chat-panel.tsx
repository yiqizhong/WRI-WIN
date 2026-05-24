import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Paperclip } from "lucide-react";
import type { AgentRunEvent, PasteTextConversation, PasteTextMessage } from "@writer/contracts";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InlineAlert } from "@/components/writer/inline-alert";

import type { DaemonClient } from "./daemon-client";
import { DaemonClientError } from "./daemon-client";
import { useWorkspace } from "./workspace-context";
import { WriterSectionHeader } from "./layout/writer-headings";
import {
  chatBubble,
  chatBubbleEnd,
  hugWidth,
  stackFill,
  surfaceFillHeight
} from "./layout/writer-sizing";

type PasteTextChatPanelProps = {
  client: DaemonClient;
  daemonConnected: boolean;
};

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

function hasPendingAssistant(conversation: PasteTextConversation | null): boolean {
  return (
    conversation?.messages.some((message) => message.role === "assistant" && message.status === "pending") ??
    false
  );
}

export function PasteTextChatPanel({ client, daemonConnected }: PasteTextChatPanelProps) {
  const { workspaceProjectId, selectedProductId, workspaceReady } = useWorkspace();
  const [backgroundContext, setBackgroundContext] = useState("");
  const [showBackground, setShowBackground] = useState(true);
  const [conversation, setConversation] = useState<PasteTextConversation | null>(null);
  const [draftText, setDraftText] = useState("");
  const [rowIndex, setRowIndex] = useState("0");
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const pendingAssistant = useMemo(
    () => conversation?.messages.find((message) => message.role === "assistant" && message.status === "pending"),
    [conversation?.messages]
  );

  const isStructured = conversation?.inputMode === "structured_file";
  const attachment = conversation?.attachment;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length, sending, streamingText]);

  useEffect(() => {
    setConversation(null);
    setDraftText("");
    setError(null);
    setStreamingText(null);
  }, [workspaceProjectId, selectedProductId]);

  useEffect(() => {
    if (!conversation?.id || !pendingAssistant) {
      setStreamingText(null);
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
          setConversation(fresh);
          setStreamingText(null);
          return;
        }

        if (!runId && assistant.agentRunId) {
          runId = assistant.agentRunId;
          setConversation(fresh);
        }

        if (!runId) {
          return;
        }

        const detail = await client.getAgentRun(runId);
        if (cancelled) {
          return;
        }

        const text = streamingTextFromEvents(detail.events);
        setStreamingText(text || null);

        if (TERMINAL_RUN_STATUSES.has(detail.run.status)) {
          const completed = await client.getPasteTextConversation(conversation.id);
          if (!cancelled) {
            setConversation(completed);
            setStreamingText(null);
          }
        }
      } catch {
        // Keep polling; fall back to conversation refresh on the next tick.
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 100);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [client, conversation?.id, pendingAssistant?.id, pendingAssistant?.agentRunId]);

  const ensureConversation = useCallback(async (): Promise<PasteTextConversation> => {
    if (conversation) {
      return conversation;
    }

    if (!workspaceProjectId) {
      throw new Error("App workspace is not ready yet.");
    }

    const created = await client.createPasteTextConversation({
      projectId: workspaceProjectId,
      backgroundContext: backgroundContext.trim() || undefined
    });
    setConversation(created);
    return created;
  }, [workspaceProjectId, backgroundContext, client, conversation]);

  const pendingRewrite = hasPendingAssistant(conversation);

  async function handleSend() {
    const text = draftText.trim();
    if (!text || !daemonConnected || !workspaceReady || !selectedProductId) {
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

      setConversation(result.conversation);
      setDraftText("");
      setShowBackground(false);
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

  async function handleAttach() {
    if (!daemonConnected || !workspaceReady) {
      return;
    }

    const filePath = await window.writerDesktop.pickPasteTextAttachment();
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
      setConversation(updated);
      setShowBackground(false);
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

  function startNewConversation() {
    setConversation(null);
    setDraftText("");
    setError(null);
    setShowBackground(true);
    setRowIndex("0");
    setStreamingText(null);
  }

  return (
    <Card className={surfaceFillHeight}>
      <CardContent className={`flex flex-col gap-5 pt-6 ${stackFill}`}>
        <WriterSectionHeader
          title="Rewrite copy"
          actions={
            conversation ? (
              <Button variant="ghost" size="sm" className={hugWidth} onClick={startNewConversation}>
                New conversation
              </Button>
            ) : null
          }
        />

        {!selectedProductId ? (
          <InlineAlert
            kind="info"
            title="Select a product"
            subtitle="Choose a product in the Figma audit panel before rewriting copy."
          />
        ) : null}

        {showBackground || !conversation ? (
          <div className="flex flex-col gap-3">
            <Button
              variant="ghost"
              size="sm"
              className={hugWidth}
              onClick={() => setShowBackground((value) => !value)}
              disabled={Boolean(conversation?.messages.length)}
            >
              {showBackground ? "Hide background" : "Show background"}
            </Button>
            {showBackground ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="paste-text-background">Background</Label>
                <p className="text-sm text-muted-foreground">Screen context, tone, terminology.</p>
                <Textarea
                  id="paste-text-background"
                  rows={3}
                  placeholder="Settings page, confirm destructive action, friendly but direct…"
                  value={backgroundContext}
                  onChange={(event) => setBackgroundContext(event.target.value)}
                  disabled={Boolean(conversation?.messages.length)}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {attachment ? (
          <p className="writer-type-helper">
            Attached: {attachment.fileName}
            {isStructured ? " · structured file mode" : " · plain text file"}
          </p>
        ) : null}

        {isStructured ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="paste-text-row-index">Row index</Label>
            <p className="text-sm text-muted-foreground">0-based row to rewrite.</p>
            <Input
              id="paste-text-row-index"
              value={rowIndex}
              onChange={(event) => setRowIndex(event.target.value)}
              className={`${hugWidth} writer-row-index-input`}
            />
          </div>
        ) : null}

        <div className="writer-chat-scroll">
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
                      {body}
                      {showCursor ? "▍" : null}
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
            <p className="writer-type-body-compact writer-text-secondary">No messages.</p>
          )}
        </div>

        {error ? (
          <InlineAlert kind="error" title="Send failed" subtitle={error} onClose={() => setError(null)} />
        ) : null}

        <div className="writer-composer-row">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="paste-text-composer">Copy to rewrite</Label>
            <Textarea
              id="paste-text-composer"
              className="writer-composer-input"
              placeholder="Paste copy and send…"
              rows={3}
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              disabled={!workspaceReady || !selectedProductId || !daemonConnected || sending || pendingRewrite}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
            />
          </div>
          <div className="writer-composer-actions">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Attach file"
              onClick={() => void handleAttach()}
              disabled={!workspaceReady || !daemonConnected || attaching || sending || pendingRewrite}
            >
              <Paperclip className="size-4" />
            </Button>
            <Button
              disabled={
                !workspaceReady ||
                !selectedProductId ||
                !daemonConnected ||
                sending ||
                pendingRewrite ||
                !draftText.trim()
              }
              onClick={() => void handleSend()}
            >
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
