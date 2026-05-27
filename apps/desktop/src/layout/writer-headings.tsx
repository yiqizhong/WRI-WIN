import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function WriterSectionHeader({
  title,
  description,
  actions,
  className
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-1", className)}>
      <div className="flex w-full min-w-0 items-center justify-between">
        <h2 className="writer-home-text writer-home-section-title min-w-0 shrink-0">{title}</h2>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {description ? (
        <p className="writer-home-text writer-home-section-description w-full min-w-0">{description}</p>
      ) : null}
    </div>
  );
}

export function WriterHomeDivider({ className }: { className?: string }) {
  return <div className={cn("writer-home-divider shrink-0", className)} aria-hidden />;
}

export function WriterSectionDescription({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>;
}
