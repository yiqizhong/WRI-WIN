import type { ReactNode, RefObject } from "react";

import type { ChatPhase } from "./chat-phase";

type ChatShellViewProps = {
  phase: ChatPhase;
  welcomeGreeting: ReactNode;
  thread: ReactNode;
  composer: ReactNode;
  error?: ReactNode;
  threadScrollRef?: RefObject<HTMLDivElement | null>;
  composerFooterRef?: RefObject<HTMLDivElement | null>;
};

export function ChatShellView({
  phase,
  welcomeGreeting,
  thread,
  composer,
  error,
  threadScrollRef,
  composerFooterRef
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
    <div className="writer-chat-active-shell flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="writer-chat-scroll-region relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <div ref={threadScrollRef} className="writer-chat-scroll h-full min-h-0 px-4 py-4">
          {thread}
        </div>
      </div>
      {error ? <div className="shrink-0 px-4">{error}</div> : null}
      <div
        ref={composerFooterRef}
        className="writer-chat-composer-footer mt-auto w-full min-w-0 shrink-0 px-4 pb-4 pt-2"
      >
        <div className="writer-chat-composer-footer__inner">
          {composer}
          <p className="writer-chat-composer-disclaimer" role="note">
            AI can make mistakes
          </p>
        </div>
      </div>
    </div>
  );
}
