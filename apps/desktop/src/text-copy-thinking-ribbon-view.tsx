import type { AgentRunEvent } from "@writer/contracts";

import { cn } from "@/lib/utils";

import {
  deriveThinkingRibbonPhase,
  THINKING_RIBBON_FAILED_LABEL
} from "./text-copy-thinking-ribbon";
import { TextCopyThinkingRibbonIcon } from "./text-copy-thinking-ribbon-icon";
import { useThinkingRibbonStatusMessage } from "./use-thinking-ribbon-status-message";

type TextCopyThinkingRibbonViewProps = {
  runStatus?: string;
  events: AgentRunEvent[];
  assistantFailed?: boolean;
};

export function TextCopyThinkingRibbonView({
  runStatus,
  events,
  assistantFailed
}: TextCopyThinkingRibbonViewProps) {
  const phase = deriveThinkingRibbonPhase({ runStatus, events, assistantFailed });
  const failed = phase === "failed";
  const statusMessage = useThinkingRibbonStatusMessage(!failed);

  return (
    <p
      className={cn(
        "writer-type-helper writer-chat-thinking-ribbon--enter flex items-center gap-2",
        failed && "text-destructive"
      )}
      role="status"
      aria-live="polite"
    >
      <TextCopyThinkingRibbonIcon failed={failed} />
      {failed ? (
        <span>{THINKING_RIBBON_FAILED_LABEL}</span>
      ) : (
        <span className="writer-chat-thinking-label">{statusMessage}</span>
      )}
    </p>
  );
}
