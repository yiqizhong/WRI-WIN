import { useEffect, useState } from "react";
import type { AgentRunEvent } from "@writer/contracts";

import {
  deriveThinkingRibbonPhase,
  THINKING_RIBBON_LABELS,
  THINKING_RIBBON_PHASES,
  type ThinkingRibbonPhase
} from "./text-copy-thinking-ribbon";

const MIN_PHASE_MS = 200;

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
  const targetPhase = deriveThinkingRibbonPhase({ runStatus, events, assistantFailed });
  const [displayPhase, setDisplayPhase] = useState<ThinkingRibbonPhase>(targetPhase);

  useEffect(() => {
    if (targetPhase === displayPhase) {
      return;
    }

    const timer = window.setTimeout(() => setDisplayPhase(targetPhase), MIN_PHASE_MS);
    return () => window.clearTimeout(timer);
  }, [targetPhase, displayPhase]);

  if (displayPhase === "failed") {
    return (
      <p className="writer-type-helper text-destructive" role="status">
        {THINKING_RIBBON_LABELS.failed}
      </p>
    );
  }

  const activeIndex = THINKING_RIBBON_PHASES.indexOf(
    THINKING_RIBBON_PHASES.includes(displayPhase) ? displayPhase : "connecting"
  );

  return (
    <ul className="flex flex-col gap-1 animate-pulse" role="status" aria-live="polite">
      {THINKING_RIBBON_PHASES.map((phase, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;
        return (
          <li
            key={phase}
            className={
              "writer-type-helper " +
              (done ? "text-muted-foreground line-through" : active ? "text-foreground" : "text-muted-foreground/60")
            }
          >
            {done ? "✓ " : active ? "● " : "○ "}
            {THINKING_RIBBON_LABELS[phase]}
          </li>
        );
      })}
    </ul>
  );
}
