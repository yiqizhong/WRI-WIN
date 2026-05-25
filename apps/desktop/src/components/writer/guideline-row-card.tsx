import { ChevronDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/writer/glass-card";
import { cn } from "@/lib/utils";

type GuidelineRowCardProps = {
  title: string;
  subtitle?: string;
  className?: string;
  onOpen: () => void;
};

export function GuidelineRowCard({ title, subtitle, className, onOpen }: GuidelineRowCardProps) {
  return (
    <GlassCard
      variant="outline"
      className={cn(
        "flex w-full min-h-[61px] cursor-pointer items-center justify-between gap-3 px-4 py-2.5",
        className
      )}
      onClick={onOpen}
    >
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <strong className="writer-home-text truncate font-semibold">{title}</strong>
        {subtitle ? <span className="text-xs text-[#e5f1ff]/60">{subtitle}</span> : null}
      </span>
      <ChevronDown className="size-4 shrink-0 text-[#e5f1ff]/60" aria-hidden />
    </GlassCard>
  );
}

/** Uploaded guideline file — same row chrome, inline remove (no modal / chevron). */
export function GuidelineFileRow({
  title,
  subtitle,
  onRemove,
  removeDisabled,
  removeLabel,
  className
}: {
  title: string;
  subtitle?: string;
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
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <strong className="writer-home-text truncate font-semibold">{title}</strong>
        {subtitle ? <span className="text-xs text-[#e5f1ff]/60">{subtitle}</span> : null}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-[var(--writer-accent-orange)] hover:bg-[rgb(230_127_1/0.14)] hover:text-[var(--writer-accent-orange)]"
        disabled={removeDisabled}
        aria-label={removeLabel}
        onClick={onRemove}
      >
        <X className="size-4" strokeWidth={1.5} aria-hidden />
      </Button>
    </GlassCard>
  );
}
