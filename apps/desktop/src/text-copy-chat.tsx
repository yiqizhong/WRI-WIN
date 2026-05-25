import type { KeyboardEvent } from "react";
import { ArrowUp, ChevronDown, Copy, SquarePen } from "lucide-react";
import type { PasteTextConversation, PasteTextMessage, ProductPackageListItem } from "@writer/contracts";

import { GlassCard } from "@/components/writer/glass-card";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InlineAlert } from "@/components/writer/inline-alert";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

import type { DaemonClient } from "./daemon-client";
import { chatBubble, chatBubbleEnd, hugWidth } from "./layout/writer-sizing";
import { ChatShellView } from "./paste-text-chat-runtime/chat-shell-view";
import { messagePreview } from "./paste-text-chat-runtime/message-display";
import { usePasteTextChatRuntime } from "./paste-text-chat-runtime/use-paste-text-chat-runtime";
import { TextCopyAttachmentMenu, type PasteTextAttachmentKind } from "./text-copy-attachment-menu";
import { TextCopyThinkingRibbonView } from "./text-copy-thinking-ribbon-view";

type TextCopyChatProps = {
  client: DaemonClient;
  daemonConnected: boolean;
  workspaceReady: boolean;
  projectId: string;
  productId?: string;
  productName: string;
  products: ProductPackageListItem[];
  conversation: PasteTextConversation | null;
  onConversationChange: (conversation: PasteTextConversation | null) => void;
  onRequestNewConversation: () => void;
  onChangeProduct: (productId: string | undefined) => void;
};

export function TextCopyChat({
  client,
  daemonConnected,
  workspaceReady,
  projectId,
  productId,
  productName,
  products,
  conversation,
  onConversationChange,
  onRequestNewConversation,
  onChangeProduct
}: TextCopyChatProps) {
  const runtime = usePasteTextChatRuntime({
    client,
    daemonConnected,
    workspaceReady,
    projectId,
    productId,
    conversation,
    onConversationChange
  });

  const {
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
    attaching,
    streamingText,
    runStatus,
    runEvents,
    messagesEndRef,
    threadScrollRef,
    isStructured,
    attachment,
    composerSendDisabled,
    sendMessage,
    attachFile,
    resetToWelcome,
    copySuggestion
  } = runtime;

  const composerDisabled = !workspaceReady || !daemonConnected || attaching;

  const composerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") {
      return;
    }
    if (event.shiftKey) {
      return;
    }
    if (phase === "active" && !(event.metaKey || event.ctrlKey)) {
      return;
    }
    event.preventDefault();
    void sendMessage();
  };

  const attachmentMeta =
    attachment ? (
      <p className="writer-type-helper mb-1.5 px-1 text-muted-foreground">
        {attachment.fileName}
        {isStructured ? " · structured file mode" : ""}
      </p>
    ) : null;

  const structuredRowIndex =
    isStructured ? (
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="shrink-0 text-xs text-muted-foreground">Row index</span>
        <Input
          id="text-copy-row-index"
          value={rowIndex}
          onChange={(event) => setRowIndex(event.target.value)}
          className="h-6 w-16 px-2 text-xs"
        />
      </div>
    ) : null;

  const welcomeComposerPanel = (
    <div className="w-full">
      {attachmentMeta}
      {structuredRowIndex}
      <GlassCard className="writer-chat-welcome-composer">
        <div className="writer-chat-welcome-composer-stack">
          <div className="writer-chat-welcome-composer-field">
            <Textarea
              id="text-copy-composer"
              className={cn(
                "writer-chat-welcome-input md:!text-[17px]",
                "!block !min-h-0 w-full resize-none !rounded-none border-0 bg-transparent px-0 !py-0",
                "shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:border-transparent"
              )}
              placeholder="i am read!"
              rows={1}
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              disabled={composerDisabled}
              onKeyDown={composerKeyDown}
            />
          </div>
          <div className="writer-chat-welcome-toolbar">
            <WriterPrimaryButton
              disabled={composerSendDisabled || !draftText.trim()}
              onClick={() => void sendMessage()}
              className="h-8 w-8 shrink-0 px-0 py-0"
              aria-label="Send message"
            >
              <ArrowUp className="size-4" strokeWidth={2} aria-hidden />
            </WriterPrimaryButton>
          </div>
        </div>
      </GlassCard>
    </div>
  );

  const activeComposerPanel = (
    <div className="w-full">
      {attachmentMeta}
      {structuredRowIndex}
      <div className="flex items-end gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-md">
        <TextCopyAttachmentMenu
          disabled={composerDisabled || composerSendDisabled || attaching}
          attaching={attaching}
          onAttach={(kind) => void attachFile(kind)}
        />
        <Textarea
          id="text-copy-composer"
          className="writer-composer-input min-h-0 flex-1 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          placeholder="Ask Writer…"
          rows={2}
          value={draftText}
          onChange={(event) => setDraftText(event.target.value)}
          disabled={composerDisabled}
          onKeyDown={composerKeyDown}
        />
        <Button
          type="button"
          size="icon-sm"
          disabled={composerSendDisabled || !draftText.trim()}
          onClick={() => void sendMessage()}
          className="shrink-0 self-end rounded-lg"
        >
          <ArrowUp className="size-4" />
        </Button>
      </div>
    </div>
  );

  const composerPanel = phase === "welcome" ? welcomeComposerPanel : activeComposerPanel;

  const errorAlert =
    error ? (
      <InlineAlert kind="error" title="Send failed" subtitle={error} onClose={() => setError(null)} />
    ) : null;

  const thread = (
    <div className="flex flex-col gap-5">
      {displayMessages.map((message) => {
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
            {isAssistant && isFailed ? (
              <Button
                variant="ghost"
                size="sm"
                className={hugWidth}
                disabled={composerSendDisabled}
                onClick={() => {
                  const idx = displayMessages.findIndex((m) => m.id === message.id);
                  const lastUser = [...displayMessages.slice(0, idx)]
                    .reverse()
                    .find((m: PasteTextMessage) => m.role === "user");
                  if (lastUser) void sendMessage(lastUser.text);
                }}
              >
                Retry
              </Button>
            ) : null}
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
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-3 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 font-medium text-foreground/80 hover:text-foreground"
              >
                {productName}
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => onChangeProduct(undefined)}
              className={!productId ? "font-semibold" : ""}
            >
              Company &amp; software rules
            </DropdownMenuItem>
            {products.map((product) => (
              <DropdownMenuItem
                key={product.id}
                onClick={() => onChangeProduct(product.id)}
                className={productId === product.id ? "font-semibold" : ""}
              >
                {product.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {conversation || phase === "active" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="New conversation"
            onClick={() => {
              resetToWelcome();
              onRequestNewConversation();
            }}
          >
            <SquarePen className="size-4" />
          </Button>
        ) : null}
      </div>

      <ChatShellView
        phase={phase}
        threadScrollRef={threadScrollRef}
        welcomeGreeting={
          <h1 className="writer-chat-welcome-heading writer-home-text writer-home-heading w-full">
            <span className="writer-chat-welcome-heading-lead">Audit text for </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    className="writer-chat-welcome-product-trigger h-auto gap-1 px-1 py-0 font-[inherit] text-[length:inherit] leading-[inherit] tracking-[inherit] hover:bg-transparent"
                  >
                    <span className="writer-chat-welcome-product-label">
                      {productId ? productName : "请选择你的产品"}
                    </span>
                    <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
                  </Button>
                }
              />
              <DropdownMenuContent align="center">
                <DropdownMenuItem
                  onClick={() => onChangeProduct(undefined)}
                  className={!productId ? "font-semibold" : ""}
                >
                  Company &amp; software rules
                </DropdownMenuItem>
                {products.map((product) => (
                  <DropdownMenuItem
                    key={product.id}
                    onClick={() => onChangeProduct(product.id)}
                    className={productId === product.id ? "font-semibold" : ""}
                  >
                    {product.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </h1>
        }
        thread={thread}
        composer={composerPanel}
        error={errorAlert}
      />
    </div>
  );
}
