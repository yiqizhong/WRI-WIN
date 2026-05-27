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
              "writer-pill-ghost writer-pill-ghost--icon writer-pill-ghost--accent inline-flex shrink-0 text-[#e5f1ff]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--writer-accent-blue)]/40",
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
