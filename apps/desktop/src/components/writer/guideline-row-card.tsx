import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/writer/glass-card";
import { cn } from "@/lib/utils";

type GuidelineRowCardProps = {
  title: string;
  className?: string;
  onOpen: () => void;
};

export function GuidelineRowCard({ title, className, onOpen }: GuidelineRowCardProps) {
  return (
    <GlassCard
      variant="outline"
      className={cn(
        "flex w-full min-h-[61px] cursor-pointer items-center justify-between gap-3 px-4 py-2.5",
        className
      )}
      onClick={onOpen}
    >
      <span className="writer-home-text min-w-0 flex-1 truncate font-semibold tracking-normal">{title}</span>
      <ChevronRight className="size-4 shrink-0 text-[#e5f1ff]/60" aria-hidden />
    </GlassCard>
  );
}

/** Uploaded guideline file — same row chrome, inline remove (no modal / chevron). */
export function GuidelineFileRow({
  title,
  onRemove,
  removeDisabled,
  removeLabel,
  className
}: {
  title: string;
  onRemove: () => void;
  removeDisabled?: boolean;
  removeLabel: string;
  className?: string;
}) {
  return (
    <GlassCard
      variant="outline"
      className={cn(
        "flex w-full min-h-[61px] items-center justify-between gap-3 px-4 py-2.5",
        className
      )}
    >
      <span className="writer-home-text min-w-0 flex-1 truncate font-semibold tracking-normal">{title}</span>
      <Button
        type="button"
        variant="ghost"
        className="writer-pill-ghost writer-pill-ghost--orange shrink-0 text-sm"
        disabled={removeDisabled}
        aria-label={removeLabel}
        onClick={onRemove}
      >
        Remove
      </Button>
    </GlassCard>
  );
}
