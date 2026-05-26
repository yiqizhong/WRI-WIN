import type { KeyboardEvent } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Copy, Plus, RotateCw } from "lucide-react";
import type { PasteTextConversation, PasteTextMessage, ProductPackageListItem } from "@writer/contracts";

import { WriterChatComposer } from "@/components/writer/writer-chat-composer";
import { WriterPageSubheader } from "@/components/writer/writer-page-subheader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineAlert } from "@/components/writer/inline-alert";
import { formatProductDisplayName } from "@/lib/writer-product-display";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

import type { DaemonClient } from "./daemon-client";
import { chatBubbleEnd } from "./layout/writer-sizing";
import { ChatShellView } from "./paste-text-chat-runtime/chat-shell-view";
import {
  getMessageVariants,
  messagePreview
} from "./paste-text-chat-runtime/message-display";
import { isOptimisticMessageId } from "./paste-text-chat-runtime/optimistic-turn";
import { usePasteTextChatRuntime } from "./paste-text-chat-runtime/use-paste-text-chat-runtime";
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
    attaching,
    streamingText,
    runStatus,
    runEvents,
    messagesEndRef,
    threadScrollRef,
    composerFooterRef,
    isStructured,
    attachment,
    composerSendDisabled,
    sendMessage,
    resetToWelcome,
    copySuggestion,
    regenerateAssistant,
    resolveMessageVariantIndex,
    setMessageVariantIndex
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

  const composerPanel = (
    <WriterChatComposer
      value={draftText}
      onChange={setDraftText}
      onSend={sendMessage}
      disabled={composerDisabled}
      sendDisabled={composerSendDisabled}
      onKeyDown={composerKeyDown}
      playIntro={phase === "welcome" || welcomeSendTransition}
      suppressHeightMotion={welcomeSendTransition}
      extras={
        <>
          {attachmentMeta}
          {structuredRowIndex}
        </>
      }
    />
  );

  const errorAlert =
    error ? (
      <InlineAlert kind="error" title="Send failed" subtitle={error} onClose={() => setError(null)} />
    ) : null;

  const userMessageCount = displayMessages.filter((message) => message.role === "user").length;
  const lastUserMessageId = lastMessageIdByRole(displayMessages, "user");

  const thread = (
    <div className="writer-chat-thread flex flex-col gap-8">
      {displayMessages.map((message) => {
        const isAssistant = message.role === "assistant";
        const isPending = message.status === "pending";
        const isFailed = message.status === "failed";
        const showStream = isPending && message.id === pendingAssistant?.id;
        const showPendingRibbon = showStream && !streamingText;
        const variantIndex = resolveMessageVariantIndex(message);
        const variants = getMessageVariants(message);
        const body = messagePreview(message, showStream ? streamingText : null, {
          variantIndex
        });
        const showCursor = showStream && Boolean(streamingText);

        if (!isAssistant) {
          const isOptimistic = isOptimisticMessageId(message.id);
          const isWelcomeSendMessage = welcomeSendTransition && message.id === lastUserMessageId;
          const isFirstSendRise = isWelcomeSendMessage || (isOptimistic && userMessageCount === 1);
          return (
            <div key={message.id} className="flex justify-end">
              <div
                className={cn(
                  chatBubbleEnd,
                  "writer-chat-user-bubble",
                  isFirstSendRise && "writer-chat-user-bubble--first-send-rise",
                  isOptimistic && !isFirstSendRise && "writer-chat-user-bubble--entering"
                )}
              >
                {body}
              </div>
            </div>
          );
        }

        if (isAssistant && isPending && welcomeSendTransition && !welcomeThinkingVisible) {
          return null;
        }

        return (
          <div key={message.id} className="flex flex-col items-start gap-2">
            {showPendingRibbon ? (
              <TextCopyThinkingRibbonView
                runStatus={runStatus}
                events={runEvents}
                assistantFailed={isFailed}
              />
            ) : (
              <p
                className={cn(
                  "writer-chat-assistant-text m-0 max-w-full whitespace-pre-wrap text-base leading-relaxed tracking-normal",
                  isFailed && "text-destructive"
                )}
              >
                {body}
                {showCursor ? "▍" : null}
              </p>
            )}
            {isAssistant && !isPending ? (
              <div className="writer-chat-message-actions flex w-full max-w-full items-center justify-between gap-3">
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="writer-chat-toolbar-btn"
                    aria-label={copiedId === message.id ? "Copied" : "Copy suggestion"}
                    onClick={() => void copySuggestion(message, variantIndex)}
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="writer-chat-toolbar-btn"
                    aria-label={isFailed ? "Retry" : "Refresh"}
                    disabled={composerSendDisabled}
                    onClick={() => void regenerateAssistant(message.id)}
                  >
                    <RotateCw className="size-4" />
                  </Button>
                </div>
                {variants.length > 1 ? (
                  <div
                    className="writer-chat-variant-nav flex items-center gap-0.5"
                    aria-label={`Suggestion variant ${variantIndex + 1} of ${variants.length}`}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="writer-chat-toolbar-btn"
                      aria-label="Previous suggestion"
                      disabled={variantIndex <= 0}
                      onClick={() => setMessageVariantIndex(message.id, variantIndex - 1)}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="writer-chat-variant-indicator tabular-nums">
                      {variantIndex + 1}/{variants.length}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="writer-chat-toolbar-btn"
                      aria-label="Next suggestion"
                      disabled={variantIndex >= variants.length - 1}
                      onClick={() => setMessageVariantIndex(message.id, variantIndex + 1)}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );

  const showNewChat = Boolean(conversation) || phase === "active";
  const subheaderTitle = phase === "active" ? `Audit copy for ${productName}` : "Chat";

  const handleNewChat = () => {
    resetToWelcome();
    onRequestNewConversation();
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <WriterPageSubheader
        title={subheaderTitle}
        backTo="/"
        backLabel="Return to home"
        trailing={
          showNewChat ? (
            <Button
              type="button"
              variant="ghost"
              className="writer-chat-subheader__new-chat"
              onClick={handleNewChat}
            >
              <Plus className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
              <span>New Chat</span>
            </Button>
          ) : null
        }
      />

      <ChatShellView
        phase={phase}
        welcomeSendTransition={welcomeSendTransition}
        onWelcomeSendTransitionComplete={completeWelcomeSendTransition}
        threadScrollRef={threadScrollRef}
        composerFooterRef={composerFooterRef}
        welcomeGreeting={
          <h1 className="writer-chat-welcome-heading writer-home-text writer-home-heading w-full">
            <span className="writer-chat-welcome-heading-lead">Audit copy for </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    className="writer-chat-welcome-product-trigger h-auto gap-1 px-1 py-0 font-[inherit] text-[length:inherit] leading-[inherit] tracking-[inherit] hover:bg-transparent dark:hover:bg-transparent aria-expanded:bg-transparent dark:aria-expanded:bg-transparent"
                  >
                    <span className="writer-chat-welcome-product-label">{productName}</span>
                    <ChevronDown className="writer-chat-welcome-product-chevron size-4 shrink-0" aria-hidden />
                  </Button>
                }
              />
              <DropdownMenuContent align="center" className="writer-product-menu">
                <DropdownMenuItem
                  onClick={() => onChangeProduct(undefined)}
                  className={cn(
                    "writer-product-menu-item",
                    !productId && "writer-product-menu-item--selected"
                  )}
                >
                  General purpose
                </DropdownMenuItem>
                {products.map((product) => (
                  <DropdownMenuItem
                    key={product.id}
                    onClick={() => onChangeProduct(product.id)}
                    className={cn(
                      "writer-product-menu-item",
                      productId === product.id && "writer-product-menu-item--selected"
                    )}
                  >
                    {formatProductDisplayName(product.name)}
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

function lastMessageIdByRole(messages: PasteTextMessage[], role: PasteTextMessage["role"]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === role) {
      return message.id;
    }
  }
  return null;
}
