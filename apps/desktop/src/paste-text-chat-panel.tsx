import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  IconButton,
  InlineNotification,
  Stack,
  TextArea,
  TextInput,
  Tile
} from "@carbon/react";
import { Attachment, Copy } from "@carbon/icons-react";
import type { AgentRunEvent, PasteTextConversation, PasteTextMessage, Project } from "@writer/contracts";

import type { DaemonClient } from "./daemon-client";
import { DaemonClientError } from "./daemon-client";
import {
  chatBubble,
  chatBubbleEnd,
  hugHeight,
  hugWidth,
  rowBetween,
  stackFill,
  surfaceFillHeight
} from "./layout/writer-sizing";

type PasteTextChatPanelProps = {
  client: DaemonClient;
  activeProject: Project | null;
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

export function PasteTextChatPanel({ client, activeProject, daemonConnected }: PasteTextChatPanelProps) {
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
  }, [activeProject?.id]);

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
    const timer = window.setInterval(() => void poll(), 250);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [client, conversation?.id, pendingAssistant?.id, pendingAssistant?.agentRunId]);

  const ensureConversation = useCallback(async (): Promise<PasteTextConversation> => {
    if (conversation) {
      return conversation;
    }

    if (!activeProject) {
      throw new Error("Open a project before starting paste text rewrite.");
    }

    const created = await client.createPasteTextConversation({
      projectId: activeProject.id,
      backgroundContext: backgroundContext.trim() || undefined
    });
    setConversation(created);
    return created;
  }, [activeProject, backgroundContext, client, conversation]);

  const pendingRewrite = hasPendingAssistant(conversation);

  async function handleSend() {
    const text = draftText.trim();
    if (!text || !daemonConnected || !activeProject) {
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
      setError(err instanceof DaemonClientError ? err.message : err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  async function handleAttach() {
    if (!daemonConnected || !activeProject) {
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
      setError(err instanceof DaemonClientError ? err.message : err instanceof Error ? err.message : "Could not attach file.");
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
    <Tile className={surfaceFillHeight}>
      <Stack gap={5} className={stackFill}>
        <div className={rowBetween}>
          <Stack gap={2} className={hugHeight}>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Paste text rewrite</h2>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--cds-text-secondary)" }}>
              Chat-style copy rewrite. Set UI background, paste copy or attach a file, then copy the suggestion.
            </p>
          </Stack>
          {conversation ? (
            <Button kind="ghost" size="sm" className={hugWidth} onClick={startNewConversation}>
              New conversation
            </Button>
          ) : null}
        </div>

        {!activeProject ? (
          <InlineNotification
            kind="info"
            lowContrast
            title="Project required"
            subtitle="Open a project from the header before using paste text rewrite."
            hideCloseButton
          />
        ) : null}

        {showBackground || !conversation ? (
          <Stack gap={3}>
            <Button
              kind="ghost"
              size="sm"
              className={hugWidth}
              onClick={() => setShowBackground((value) => !value)}
              disabled={Boolean(conversation?.messages.length)}
            >
              {showBackground ? "Hide background" : "Show background"}
            </Button>
            {showBackground ? (
              <TextArea
                id="paste-text-background"
                labelText="UI background and writing rules"
                helperText="Describe screen context, tone, and terminology constraints before you send copy."
                rows={3}
                placeholder="e.g. Settings page, confirm destructive action, friendly but direct…"
                value={backgroundContext}
                onChange={(event) => setBackgroundContext(event.target.value)}
                disabled={Boolean(conversation?.messages.length)}
              />
            ) : null}
          </Stack>
        ) : null}

        {attachment ? (
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--cds-text-secondary)" }}>
            Attached: {attachment.fileName}
            {isStructured ? " · structured file mode" : " · plain text file"}
          </p>
        ) : null}

        {isStructured ? (
          <TextInput
            id="paste-text-row-index"
            labelText="Spreadsheet row index"
            helperText="Row to rewrite when sending a message (0-based)."
            value={rowIndex}
            onChange={(event) => setRowIndex(event.target.value)}
            className={hugWidth}
            style={{ maxWidth: "12.5rem" }}
          />
        ) : null}

        <div className="writer-chat-scroll">
          {conversation?.messages.length ? (
            <Stack gap={4}>
              {conversation.messages.map((message) => {
                const isAssistant = message.role === "assistant";
                const isPending = message.status === "pending";
                const isFailed = message.status === "failed";
                const showStream = isPending && message.id === pendingAssistant?.id;
                const body = messagePreview(message, showStream ? streamingText : null);
                const showCursor = showStream && Boolean(streamingText);

                return (
                  <Stack
                    key={message.id}
                    gap={2}
                    className={isAssistant ? chatBubble : chatBubbleEnd}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--cds-text-secondary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.32px"
                      }}
                    >
                      {isAssistant ? (isPending ? "Rewriting" : isFailed ? "Failed" : "Suggestion") : "You"}
                    </span>
                    <div
                      style={{
                        padding: "var(--cds-spacing-04)",
                        background: isAssistant ? "var(--cds-layer-01)" : "var(--cds-layer-accent)",
                        border: isFailed ? "1px solid var(--cds-support-error)" : "1px solid var(--cds-border-subtle)",
                        borderRadius: 4,
                        whiteSpace: "pre-wrap",
                        fontSize: "0.875rem",
                        lineHeight: 1.5,
                        fontStyle: isPending && !streamingText ? "italic" : "normal",
                        color: isFailed ? "var(--cds-support-error)" : undefined
                      }}
                    >
                      {body}
                      {showCursor ? "▍" : null}
                    </div>
                    {isAssistant && !isPending && !isFailed ? (
                      <Button
                        kind="ghost"
                        size="sm"
                        className={hugWidth}
                        renderIcon={Copy}
                        onClick={() => void copySuggestion(message)}
                      >
                        {copiedId === message.id ? "Copied" : "Copy suggestion"}
                      </Button>
                    ) : null}
                  </Stack>
                );
              })}
              <div ref={messagesEndRef} />
            </Stack>
          ) : (
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--cds-text-secondary)" }}>
              No messages yet. Add background context, then paste UX copy below or attach a spreadsheet.
            </p>
          )}
        </div>

        {error ? (
          <InlineNotification kind="error" lowContrast title="Rewrite failed" subtitle={error} onClose={() => setError(null)} />
        ) : null}

        <div className="writer-composer-row">
          <TextArea
            id="paste-text-composer"
            className="writer-composer-input"
            labelText="Copy to rewrite"
            placeholder="Paste UX copy and press Send…"
            rows={3}
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            disabled={!activeProject || !daemonConnected || sending || pendingRewrite}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void handleSend();
              }
            }}
          />
          <div className="writer-composer-actions">
            <IconButton
              kind="ghost"
              label="Attach file"
              onClick={() => void handleAttach()}
              disabled={!activeProject || !daemonConnected || attaching || sending || pendingRewrite}
            >
              <Attachment />
            </IconButton>
            <Button
              kind="primary"
              disabled={!activeProject || !daemonConnected || sending || pendingRewrite || !draftText.trim()}
              onClick={() => void handleSend()}
            >
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </Stack>
    </Tile>
  );
}