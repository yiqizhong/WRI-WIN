import { useCallback, useEffect, useRef, useState } from "react";
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
import type { PasteTextConversation, PasteTextMessage, Project } from "@writer/contracts";

import type { DaemonClient } from "./daemon-client";
import { DaemonClientError } from "./daemon-client";

type PasteTextChatPanelProps = {
  client: DaemonClient;
  activeProject: Project | null;
  daemonConnected: boolean;
};

function messagePreview(message: PasteTextMessage): string {
  if (message.role === "assistant") {
    return message.suggestedText ?? message.text;
  }

  return message.text;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isStructured = conversation?.inputMode === "structured_file";
  const attachment = conversation?.attachment;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length, sending]);

  useEffect(() => {
    setConversation(null);
    setDraftText("");
    setError(null);
  }, [activeProject?.id]);

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

  async function handleSend() {
    const text = draftText.trim();
    if (!text || !daemonConnected || !activeProject) {
      return;
    }

    setSending(true);
    setError(null);

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
  }

  return (
    <Tile style={{ display: "flex", flexDirection: "column", minHeight: 420 }}>
      <Stack gap={5} style={{ flex: 1 }}>
        <Stack gap={3} orientation="horizontal" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <Stack gap={2}>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Paste text rewrite</h2>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--cds-text-secondary)" }}>
              Chat-style copy rewrite. Set UI background, paste copy or attach a file, then copy the suggestion.
            </p>
          </Stack>
          {conversation ? (
            <Button kind="ghost" size="sm" onClick={startNewConversation}>
              New conversation
            </Button>
          ) : null}
        </Stack>

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
              style={{ alignSelf: "flex-start", margin: 0 }}
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
            style={{ maxWidth: 200 }}
          />
        ) : null}

        <div
          style={{
            flex: 1,
            minHeight: 200,
            maxHeight: 360,
            overflowY: "auto",
            padding: "var(--cds-spacing-04)",
            background: "var(--cds-layer-02)",
            border: "1px solid var(--cds-border-subtle)"
          }}
        >
          {conversation?.messages.length ? (
            <Stack gap={4}>
              {conversation.messages.map((message) => {
                const isAssistant = message.role === "assistant";
                const body = messagePreview(message);

                return (
                  <Stack
                    key={message.id}
                    gap={2}
                    style={{
                      alignSelf: isAssistant ? "flex-start" : "flex-end",
                      maxWidth: "85%"
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--cds-text-secondary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.32px"
                      }}
                    >
                      {isAssistant ? "Suggestion" : "You"}
                    </span>
                    <div
                      style={{
                        padding: "var(--cds-spacing-04)",
                        background: isAssistant ? "var(--cds-layer-01)" : "var(--cds-layer-accent)",
                        border: "1px solid var(--cds-border-subtle)",
                        borderRadius: 4,
                        whiteSpace: "pre-wrap",
                        fontSize: "0.875rem",
                        lineHeight: 1.5
                      }}
                    >
                      {body}
                    </div>
                    {isAssistant ? (
                      <Button
                        kind="ghost"
                        size="sm"
                        renderIcon={Copy}
                        style={{ alignSelf: "flex-start" }}
                        onClick={() => void copySuggestion(message)}
                      >
                        {copiedId === message.id ? "Copied" : "Copy suggestion"}
                      </Button>
                    ) : null}
                  </Stack>
                );
              })}
              {sending ? (
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--cds-text-secondary)" }}>Rewriting…</p>
              ) : null}
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

        <Stack gap={3} orientation="horizontal" style={{ alignItems: "flex-end" }}>
          <TextArea
            id="paste-text-composer"
            labelText="Copy to rewrite"
            placeholder="Paste UX copy and press Send…"
            rows={3}
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            disabled={!activeProject || !daemonConnected || sending}
            style={{ flex: 1 }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void handleSend();
              }
            }}
          />
          <Stack gap={2}>
            <IconButton
              kind="ghost"
              label="Attach file"
              onClick={() => void handleAttach()}
              disabled={!activeProject || !daemonConnected || attaching || sending}
            >
              <Attachment />
            </IconButton>
            <Button
              kind="primary"
              disabled={!activeProject || !daemonConnected || sending || !draftText.trim()}
              onClick={() => void handleSend()}
            >
              {sending ? "Sending…" : "Send"}
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Tile>
  );
}
