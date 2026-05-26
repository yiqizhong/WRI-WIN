import type { KeyboardEvent, ReactNode } from "react";
import { ArrowUp } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { GlassCard } from "@/components/writer/glass-card";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";
import { WriterStarBorder } from "@/components/writer/writer-star-border";
import { cn } from "@/lib/utils";

export type WriterChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void | Promise<void>;
  disabled?: boolean;
  sendDisabled?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Welcome: play star-border intro once. Active chat: static idle stroke only. */
  playIntro?: boolean;
  textareaId?: string;
  placeholder?: string;
  /** Attachment label, row index, etc. — rendered above the card */
  extras?: ReactNode;
  className?: string;
};

const composerTextareaClassName = cn(
  "writer-chat-welcome-input md:!text-[17px]",
  "!block !min-h-0 w-full resize-none !rounded-none !border-0 !bg-transparent px-0 !py-0",
  "dark:!bg-transparent shadow-none outline-none ring-0 focus-visible:!ring-0 focus-visible:!border-transparent"
);

export function WriterChatComposer({
  value,
  onChange,
  onSend,
  disabled = false,
  sendDisabled = false,
  onKeyDown,
  playIntro = false,
  textareaId = "text-copy-composer",
  placeholder = "I am ready!",
  extras,
  className
}: WriterChatComposerProps) {
  const sendBlocked = sendDisabled || !value.trim();

  return (
    <div className={cn("writer-chat-composer-panel w-full", className)}>
      {extras}
      <WriterStarBorder loops={1} lapDuration={2.5} skipIntro={!playIntro}>
        <GlassCard className="writer-chat-welcome-composer">
          <div className="writer-chat-welcome-composer-stack">
            <div className="writer-chat-welcome-composer-field">
              <Textarea
                id={textareaId}
                className={composerTextareaClassName}
                placeholder={placeholder}
                rows={1}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                disabled={disabled}
                onKeyDown={onKeyDown}
              />
            </div>
            <div className="writer-chat-welcome-toolbar">
              <WriterPrimaryButton
                disabled={sendBlocked}
                onClick={() => void onSend()}
                className="h-8 w-8 shrink-0 px-0 py-0"
                aria-label="Send message"
              >
                <ArrowUp className="size-4" strokeWidth={2} aria-hidden />
              </WriterPrimaryButton>
            </div>
          </div>
        </GlassCard>
      </WriterStarBorder>
    </div>
  );
}
