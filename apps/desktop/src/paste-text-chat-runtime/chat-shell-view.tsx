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
  welcomeComposerTopPx,
  welcomeHeroLayout
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
  composerHostRef: RefObject<HTMLDivElement | null>;
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
  composerHostRef,
  composerFooterRef
}: ChatShellViewProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const welcomeHeroRef = useRef<HTMLDivElement>(null);
  const welcomeHeadingRef = useRef<HTMLDivElement>(null);
  const welcomeComposerSpacerRef = useRef<HTMLDivElement>(null);
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
    const scrollRegion = scrollRegionRef.current;
    const hero = welcomeHeroRef.current;
    const heading = welcomeHeadingRef.current;
    const spacer = welcomeComposerSpacerRef.current;

    if (welcomeSendTransition || composerAnimating) {
      return;
    }

    if (!host || composerPlacement !== "welcome-centered") {
      if (host) {
        host.style.removeProperty("top");
        host.style.removeProperty("transform");
      }
      hero?.style.removeProperty("padding-top");
      if (spacer) {
        spacer.style.removeProperty("height");
        spacer.style.removeProperty("margin-top");
      }
      return;
    }

    if (!shell || !scrollRegion || !hero || !heading || !spacer) {
      return;
    }

    const layout = welcomeHeroLayout(heading, host, scrollRegion);
    hero.style.paddingTop = `${layout.headingPadTopPx}px`;
    spacer.style.height = `${host.getBoundingClientRect().height}px`;
    host.style.top = `${welcomeComposerTopPx(spacer, shell)}px`;
    host.style.transform = "";
  }, [composerPlacement, welcomeSendTransition, composerAnimating]);

  useLayoutEffect(() => {
    syncWelcomeComposerPosition();

    if (composerPlacement !== "welcome-centered") {
      return;
    }

    const heading = welcomeHeadingRef.current;
    const shell = shellRef.current;
    const scrollRegion = scrollRegionRef.current;
    const host = composerHostRef.current;
    const spacer = welcomeComposerSpacerRef.current;
    if (!heading || !shell || !scrollRegion || !host || !spacer) {
      return;
    }

    const ro = new ResizeObserver(() => {
      syncWelcomeComposerPosition();
    });
    ro.observe(heading);
    ro.observe(shell);
    ro.observe(scrollRegion);
    ro.observe(host);
    ro.observe(spacer);

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
  const liftFooterComposer = composerPlacement === "footer";

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
      <div
        ref={scrollRegionRef}
        className="writer-chat-scroll-region relative min-h-0 min-w-0 flex-1 basis-0 overflow-hidden"
      >
        {showWelcomeStage ? (
          <div className="writer-chat-welcome-stage h-full px-4">
            <div ref={welcomeHeroRef} className="writer-chat-welcome-hero w-full max-w-[744px]">
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
                  <div
                    ref={welcomeComposerSpacerRef}
                    className="writer-chat-welcome-composer-spacer w-full shrink-0"
                    aria-hidden
                  />
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
        data-footer-lift={liftFooterComposer ? "true" : undefined}
      >
        <div className="writer-chat-composer-host__inner mx-auto w-full max-w-[744px]">
          {composerDock}
        </div>
      </div>

      {phase === "welcome" && !inWelcomeSend ? (
        <p
          className="writer-chat-composer-disclaimer writer-chat-welcome-composer-disclaimer w-full shrink-0 px-4 text-center"
          role="note"
        >
          AI can make mistakes
        </p>
      ) : null}

      <div
        ref={composerFooterRef}
        className="writer-chat-composer-footer w-full min-w-0 shrink-0 px-4 pb-4"
      >
        {phase === "active" || inWelcomeSend ? (
          <p className="writer-chat-composer-disclaimer w-full text-center" role="note">
            AI can make mistakes
          </p>
        ) : null}
      </div>
    </div>
  );
}

function cnThreadScroll(inWelcomeSend: boolean) {
  if (inWelcomeSend) {
    // Absolutely overlay the welcome stage so the user-message rise animation is visible
    // while the heading fades out and composer moves to footer.
    // pt-4 matches the py-4 top-padding used in the normal-flow state so the
    // message doesn't visually shift when the thread switches back to flow layout.
    return "writer-chat-scroll absolute inset-0 overflow-hidden px-4 pt-4 writer-chat-scroll--send-transition";
  }
  return "writer-chat-scroll h-full min-h-0 px-4 py-4";
}
