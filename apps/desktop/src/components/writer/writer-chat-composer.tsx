import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode
} from "react";
import { ArrowUp } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { GlassCard } from "@/components/writer/glass-card";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";
import { WriterStarBorder } from "@/components/writer/writer-star-border";
import { cn } from "@/lib/utils";

import { prefersReducedComposerHeightMotion } from "./writer-chat-composer-height-motion";
import {
  COMPOSER_HEIGHT_FIELD_COLLAPSE_CLASS,
  composerHeightTransitionProperty,
  isComposerHeightCollapsing
} from "./writer-chat-composer-height-transition";
import {
  composerHeightForContent,
  lineHeightFromComputedStyle,
  measureTextareaContentHeight,
  preserveComposerScrollAnchor
} from "./writer-chat-composer-sizing";

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
  /** Welcome send: skip elastic height transition so position motion does not overshoot. */
  suppressHeightMotion?: boolean;
};

const composerTextareaClassName = cn(
  "writer-chat-welcome-input md:!text-[17px]",
  "!block !min-h-0 w-full resize-none !rounded-none !border-0 !bg-transparent px-0 !py-0",
  "!field-sizing-fixed",
  "dark:!bg-transparent shadow-none outline-none ring-0 focus-visible:!ring-0 focus-visible:!border-transparent"
);

/** Gemini-style: flush layout, then CSS transition (expand 0.25s / collapse 0.5s linear spring). */
function applyAnimatedHeight(
  inner: HTMLDivElement,
  field: HTMLDivElement | null,
  nextHeightPx: number,
  lineHeight: number,
  maxLines: number
) {
  const nextHeight = `${nextHeightPx}px`;
  const minHeight = `${lineHeight}px`;
  const maxHeight = `${lineHeight * maxLines}px`;
  const startHeightPx = inner.getBoundingClientRect().height;

  if (Math.abs(startHeightPx - nextHeightPx) < 0.5) {
    field?.classList.remove(COMPOSER_HEIGHT_FIELD_COLLAPSE_CLASS);
    inner.style.transition = "none";
    inner.style.height = nextHeight;
    inner.style.minHeight = minHeight;
    inner.style.maxHeight = maxHeight;
    return;
  }

  const collapsing = isComposerHeightCollapsing(startHeightPx, nextHeightPx);
  field?.classList.toggle(COMPOSER_HEIGHT_FIELD_COLLAPSE_CLASS, collapsing);

  inner.style.transition = "none";
  inner.style.height = `${startHeightPx}px`;
  inner.style.minHeight = minHeight;
  inner.style.maxHeight = maxHeight;
  void inner.offsetHeight;
  inner.style.transition = composerHeightTransitionProperty(collapsing);
  inner.style.height = nextHeight;

  if (collapsing) {
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== inner || event.propertyName !== "height") {
        return;
      }
      field?.classList.remove(COMPOSER_HEIGHT_FIELD_COLLAPSE_CLASS);
      inner.removeEventListener("transitionend", onTransitionEnd);
    };
    inner.addEventListener("transitionend", onTransitionEnd);
  }
}

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
  className,
  suppressHeightMotion = false
}: WriterChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerFieldRef = useRef<HTMLDivElement>(null);
  const textareaInnerRef = useRef<HTMLDivElement>(null);
  const [textareaInnerStyle, setTextareaInnerStyle] = useState<CSSProperties>();
  const [textareaOverflowY, setTextareaOverflowY] = useState<"auto" | "hidden">("hidden");

  const commitTextareaInnerStyle = (
    style: CSSProperties,
    overflowY: "auto" | "hidden",
    options?: { animate?: boolean }
  ) => {
    const inner = textareaInnerRef.current;
    const animate =
      options?.animate !== false &&
      !suppressHeightMotion &&
      !prefersReducedComposerHeightMotion();

    if (inner && animate && typeof style.height === "string") {
      const nextHeightPx = Number.parseFloat(style.height);
      const lineHeight = Number.parseFloat(
        typeof style.minHeight === "string" ? style.minHeight : "0"
      );
      if (Number.isFinite(nextHeightPx) && Number.isFinite(lineHeight)) {
        applyAnimatedHeight(inner, composerFieldRef.current, nextHeightPx, lineHeight, 5);
      }
    } else if (inner) {
      composerFieldRef.current?.classList.remove(COMPOSER_HEIGHT_FIELD_COLLAPSE_CLASS);
      inner.style.transition = "none";
      inner.style.height = typeof style.height === "string" ? style.height : "";
      inner.style.minHeight =
        typeof style.minHeight === "string" ? style.minHeight : "";
      inner.style.maxHeight =
        typeof style.maxHeight === "string" ? style.maxHeight : "";
    }

    setTextareaInnerStyle(style);
    setTextareaOverflowY(overflowY);
  };

  const syncComposerHeight = (options?: { animate?: boolean }) => {
    const textarea = textareaRef.current;
    const textareaInner = textareaInnerRef.current;
    if (!textarea || !textareaInner) {
      return;
    }

    const previousScrollTop = textarea.scrollTop;
    const previousHeightPx = textareaInner.getBoundingClientRect().height;

    const computed = window.getComputedStyle(textarea);
    const lineHeight = lineHeightFromComputedStyle(computed.lineHeight, computed.fontSize);
    const scrollHeight = measureTextareaContentHeight(textarea);
    const sizing = composerHeightForContent({
      scrollHeight,
      lineHeight
    });
    const nextHeightPx = sizing.height;
    const nextStyle: CSSProperties = {
      height: `${nextHeightPx}px`,
      minHeight: `${lineHeight}px`,
      maxHeight: `${lineHeight * 5}px`
    };

    const shouldAnimate =
      options?.animate !== false &&
      Boolean(textareaInnerStyle?.height) &&
      Math.abs(nextHeightPx - previousHeightPx) > 0.5;

    commitTextareaInnerStyle(nextStyle, sizing.overflowY, {
      animate: shouldAnimate
    });

    preserveComposerScrollAnchor(
      textarea,
      previousScrollTop,
      previousHeightPx,
      nextHeightPx
    );
  };

  useLayoutEffect(() => {
    syncComposerHeight({ animate: !suppressHeightMotion });
  }, [value, suppressHeightMotion]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const onResize = () => syncComposerHeight({ animate: false });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const sendBlocked = sendDisabled || !value.trim();

  return (
    <div className={cn("writer-chat-composer-panel w-full", className)}>
      {extras}
      <WriterStarBorder loops={1} lapDuration={1.4} skipIntro={!playIntro}>
        <GlassCard className="writer-chat-welcome-composer">
          <div className="writer-chat-welcome-composer-stack">
            <div ref={composerFieldRef} className="writer-chat-welcome-composer-field">
              <div
                ref={textareaInnerRef}
                className="writer-chat-welcome-composer-textarea-inner"
                style={textareaInnerStyle}
              >
                <Textarea
                  ref={textareaRef}
                  id={textareaId}
                  className={composerTextareaClassName}
                  style={{ height: "100%", overflowY: textareaOverflowY }}
                  placeholder={placeholder}
                  rows={1}
                  value={value}
                  onChange={(event) => onChange(event.target.value)}
                  disabled={disabled}
                  onKeyDown={onKeyDown}
                />
              </div>
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
