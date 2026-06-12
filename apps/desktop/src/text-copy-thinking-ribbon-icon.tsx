import { AlertCircle } from "lucide-react";

import { SvgSpinners12DotsScaleRotate } from "@/components/ui/svg-spinners-12-dots-scale-rotate";
import { cn } from "@/lib/utils";

type TextCopyThinkingRibbonIconProps = {
  failed?: boolean;
  className?: string;
};

export function TextCopyThinkingRibbonIcon({
  failed = false,
  className
}: TextCopyThinkingRibbonIconProps) {
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
      <SvgSpinners12DotsScaleRotate className="size-4" aria-hidden />
    </span>
  );
}
