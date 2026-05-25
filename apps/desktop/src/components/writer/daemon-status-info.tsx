import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type DaemonStatusInfoProps = {
  tooltip: string;
  className?: string;
};

export function DaemonStatusInfo({ tooltip, className }: DaemonStatusInfoProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[#e5f1ff]/50 transition-colors hover:bg-[rgb(32_131_234/0.14)] hover:text-[var(--writer-accent-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--writer-accent-blue)]/40",
              className
            )}
            aria-label="About the Writer daemon"
          >
            <Info className="size-3.5" strokeWidth={1.75} aria-hidden />
          </button>
        }
      />
      <TooltipContent
        side="bottom"
        align="start"
        sideOffset={8}
        showArrow={false}
        className="writer-tooltip"
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
