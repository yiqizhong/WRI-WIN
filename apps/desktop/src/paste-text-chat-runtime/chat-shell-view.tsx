import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject
} from "react";
import { flushSync } from "react-dom";

import type { ChatPhase } from "./chat-phase";
import {
  WELCOME_INPUT_MOVE_MS,
  WELCOME_MESSAGE_RISE_MS,
  welcomeComposerTopPx
} from "./composer-motion";
import {
  animateComposerWelcomeToFooter,
  prefersReducedWelcomeSendMotion
} from "./composer-welcome-send-motion";

type ChatShellViewProps = {
  phase: ChatPhase;
  welcomeSendTransition: boolean;
  onWelcomeSendTransitionComplete: () => void;
  welcomeGreeting: ReactNode;
  thread: ReactNode;
  composer: ReactNode;
  error?: ReactNode;
  threadScrollRef?: RefObject<HTMLDivElement | null>;
  composerFooterRef?: RefObject<HTMLDivElement | null>;
};

type ComposerPlacement = "welcome-centered" | "footer";

export function ChatShellView({
  phase,
  welcomeSendTransition,
  onWelcomeSendTransitionComplete,
  welcomeGreeting,
  thread,
  composer,
  error,
  threadScrollRef,
  composerFooterRef
}: ChatShellViewProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const welcomeHeadingRef = useRef<HTMLDivElement>(null);
  const composerHostRef = useRef<HTMLDivElement>(null);
  const transitionRunIdRef = useRef(0);

  const [composerPlacement, setComposerPlacement] = useState<ComposerPlacement>(() =>
    phase === "welcome" ? "welcome-centered" : "footer"
  );
  const [headingExiting, setHeadingExiting] = useState(false);
  const [composerAnimating, setComposerAnimating] = useState(false);

  const inWelcomeSend = welcomeSendTransition || composerAnimating || headingExiting;

  const syncWelcomeComposerPosition = useCallback(() => {
    const host = composerHostRef.current;
    const shell = shellRef.current;
    const heading = welcomeHeadingRef.current;

    if (welcomeSendTransition || composerAnimating) {
      return;
    }

    if (!host || composerPlacement !== "welcome-centered" || !shell || !heading) {
      if (host && composerPlacement !== "welcome-centered") {
        host.style.removeProperty("top");
        host.style.removeProperty("transform");
      }
      return;
    }

    host.style.top = `${welcomeComposerTopPx(heading, shell)}px`;
    host.style.transform = "";
  }, [composerPlacement, welcomeSendTransition, composerAnimating]);

  useLayoutEffect(() => {
    syncWelcomeComposerPosition();

    if (composerPlacement !== "welcome-centered") {
      return;
    }

    const heading = welcomeHeadingRef.current;
    const shell = shellRef.current;
    if (!heading || !shell) {
      return;
    }

    const ro = new ResizeObserver(() => {
      syncWelcomeComposerPosition();
    });
    ro.observe(heading);
    ro.observe(shell);

    window.addEventListener("resize", syncWelcomeComposerPosition);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncWelcomeComposerPosition);
    };
  }, [composerPlacement, phase, headingExiting, syncWelcomeComposerPosition]);

  useEffect(() => {
    if (welcomeSendTransition || composerAnimating || headingExiting) {
      return;
    }

    if (phase === "active") {
      setComposerPlacement("footer");
      setHeadingExiting(false);
      return;
    }

    if (phase === "welcome") {
      setComposerPlacement("welcome-centered");
      setHeadingExiting(false);
    }
  }, [phase, welcomeSendTransition, composerAnimating, headingExiting]);

  const finishWelcomeSendTransition = () => {
    setComposerAnimating(false);
    setHeadingExiting(false);
    onWelcomeSendTransitionComplete();
  };

  useLayoutEffect(() => {
    if (!welcomeSendTransition) {
      return;
    }

    const runId = ++transitionRunIdRef.current;
    setHeadingExiting(true);

    const host = composerHostRef.current;
    if (!host) {
      finishWelcomeSendTransition();
      setComposerPlacement("footer");
      return;
    }

    const reducedMotion = prefersReducedWelcomeSendMotion();
    const inputDuration = reducedMotion ? 0 : WELCOME_INPUT_MOVE_MS;
    const totalDuration = reducedMotion
      ? 0
      : Math.max(WELCOME_INPUT_MOVE_MS, WELCOME_MESSAGE_RISE_MS);

    setComposerAnimating(true);

    const runMove = async () => {
      if (transitionRunIdRef.current !== runId) {
        return;
      }

      const fromRect = host.getBoundingClientRect();

      flushSync(() => {
        setComposerPlacement("footer");
      });

      if (reducedMotion) {
        host.style.removeProperty("top");
        return;
      }

      await animateComposerWelcomeToFooter(host, inputDuration, fromRect);
    };

    void runMove();

    const timer = window.setTimeout(() => {
      if (transitionRunIdRef.current !== runId) {
        return;
      }
      finishWelcomeSendTransition();
    }, totalDuration);

    return () => {
      transitionRunIdRef.current += 1;
      window.clearTimeout(timer);
    };
  }, [welcomeSendTransition]);

  const showWelcomeStage = phase === "welcome" || headingExiting;
  const hideThread = phase === "welcome" && !inWelcomeSend;

  const composerDock = (
    <div
      className="writer-chat-composer-motion-dock"
      data-phase={phase}
      data-placement={composerPlacement}
    >
      {composer}
    </div>
  );

  return (
    <div
      ref={shellRef}
      className="writer-chat-active-shell flex h-0 min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      data-phase={phase}
      data-send-transition={inWelcomeSend ? "true" : "false"}
      data-composer-placement={composerPlacement}
    >
      <div className="writer-chat-scroll-region relative min-h-0 min-w-0 flex-1 basis-0 overflow-hidden">
        {showWelcomeStage ? (
          <div className="writer-chat-welcome-stage h-full px-4">
            <div className="writer-chat-welcome-hero w-full max-w-[744px]">
              <div
                className={
                  headingExiting
                    ? "writer-chat-welcome-zero-state writer-chat-welcome-zero-state--leaving"
                    : "writer-chat-welcome-zero-state"
                }
              >
                <div className="writer-chat-welcome-shell flex w-full flex-col items-center">
                  <div ref={welcomeHeadingRef} className="writer-chat-welcome-heading-measure w-full">
                    {welcomeGreeting}
                  </div>
                  {phase === "welcome" ? error : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <div
          ref={threadScrollRef}
          className={
            hideThread
              ? "writer-chat-scroll pointer-events-none absolute inset-0 h-full min-h-0 overflow-hidden opacity-0"
              : cnThreadScroll(inWelcomeSend)
          }
          aria-hidden={hideThread ? true : undefined}
        >
          {thread}
        </div>
      </div>

      {phase === "active" && error ? <div className="shrink-0 px-4">{error}</div> : null}

      <div
        ref={composerHostRef}
        className="writer-chat-composer-host w-full min-w-0 shrink-0 px-4"
        data-placement={composerPlacement}
        data-animating={composerAnimating ? "true" : "false"}
      >
        <div className="writer-chat-composer-host__inner mx-auto w-full max-w-[744px]">
          {composerDock}
        </div>
      </div>

      {phase === "welcome" && !inWelcomeSend ? (
        <p
          className="writer-chat-composer-disclaimer writer-chat-welcome-composer-disclaimer mx-auto w-full max-w-[744px] shrink-0 px-4 text-center"
          role="note"
        >
          AI can make mistakes
        </p>
      ) : null}

      <div
        ref={composerFooterRef}
        className="writer-chat-composer-footer w-full min-w-0 shrink-0 px-4 pb-4"
      >
        <div className="writer-chat-composer-footer__inner">
          {phase === "active" || inWelcomeSend ? (
            <p className="writer-chat-composer-disclaimer" role="note">
              AI can make mistakes
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function cnThreadScroll(inWelcomeSend: boolean) {
  const base = "writer-chat-scroll h-full min-h-0 px-4";
  return inWelcomeSend ? `${base} writer-chat-scroll--send-transition pt-2` : `${base} py-4`;
}
