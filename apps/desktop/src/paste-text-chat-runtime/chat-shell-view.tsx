import type { ReactNode, RefObject } from "react";

import type { ChatPhase } from "./chat-phase";

type ChatShellViewProps = {
  phase: ChatPhase;
  welcomeGreeting: ReactNode;
  thread: ReactNode;
  composer: ReactNode;
  error?: ReactNode;
  threadScrollRef?: RefObject<HTMLDivElement | null>;
};

export function ChatShellView({
  phase,
  welcomeGreeting,
  thread,
  composer,
  error,
  threadScrollRef
}: ChatShellViewProps) {
  if (phase === "welcome") {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-10">
        <div className="writer-chat-welcome-shell flex flex-col items-center">
          {welcomeGreeting}
          {error}
          {composer}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div ref={threadScrollRef} className="writer-chat-scroll min-h-0 flex-1 px-4 py-4">
        {thread}
      </div>
      {error ? <div className="shrink-0 px-3">{error}</div> : null}
      <div className="mt-auto shrink-0 border-t border-border/40 bg-background/80 px-3 pb-3 pt-2 backdrop-blur-sm">
        {composer}
      </div>
    </div>
  );
}
