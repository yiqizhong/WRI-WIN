import { useEffect, useRef } from "react";
import {
  ChevronsRightIcon,
  type ChevronsRightIconHandle
} from "@animateicons/react/lucide";
import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

const ICON_SIZE = 16;
const ANIM_DURATION = 1;
/** Chevron paths play once per trigger; retrigger to loop through long runs. */
const RETRIGGER_MS = Math.round(ANIM_DURATION * 1200);

type TextCopyThinkingRibbonIconProps = {
  failed?: boolean;
  className?: string;
};

export function TextCopyThinkingRibbonIcon({
  failed = false,
  className
}: TextCopyThinkingRibbonIconProps) {
  const iconRef = useRef<ChevronsRightIconHandle>(null);

  useEffect(() => {
    if (failed) {
      iconRef.current?.stopAnimation();
      return;
    }

    const play = () => iconRef.current?.startAnimation();
    play();

    const intervalId = window.setInterval(play, RETRIGGER_MS);
    return () => {
      window.clearInterval(intervalId);
      iconRef.current?.stopAnimation();
    };
  }, [failed]);

  if (failed) {
    return (
      <AlertCircle
        className={cn("size-4 shrink-0 text-destructive", className)}
        aria-hidden
      />
    );
  }

  return (
    <span className={cn("writer-chat-thinking-icon shrink-0", className)}>
      <ChevronsRightIcon
        ref={iconRef}
        size={ICON_SIZE}
        duration={ANIM_DURATION}
        color="currentColor"
        isAnimated={false}
        aria-hidden
      />
    </span>
  );
}
