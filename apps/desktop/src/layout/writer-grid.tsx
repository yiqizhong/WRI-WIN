import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const WRITER_MINI_UNIT_PX = 8;
export const WRITER_PRODUCT_MAX_WIDTH = "72rem";

export type WriterGutterMode = "wide" | "narrow" | "condensed";

type WriterPageGridProps = {
  children: ReactNode;
  className?: string;
  gutterMode?: WriterGutterMode;
  equalRowHeight?: boolean;
};

export function WriterPageGrid({
  children,
  className,
  equalRowHeight = false
}: WriterPageGridProps) {
  return (
    <div
      className={cn(
        "grid w-full min-h-0 gap-6 overflow-hidden",
        equalRowHeight &&
          "h-full grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-2 lg:grid-rows-[auto_minmax(0,1fr)] lg:items-stretch",
        className
      )}
    >
      {children}
    </div>
  );
}

type WriterPageColumnProps = {
  children: ReactNode;
  className?: string;
  fillHeight?: boolean;
};

export function WriterPageGridFull({ children, className, fillHeight }: WriterPageColumnProps) {
  return (
    <div
      className={cn(
        "col-span-full w-full min-w-0",
        fillHeight && "flex h-full min-h-0 flex-col",
        className
      )}
    >
      {children}
    </div>
  );
}

export function WriterPageGridHalf({ children, className, fillHeight }: WriterPageColumnProps) {
  return (
    <div className={cn("w-full min-w-0", fillHeight && "flex h-full min-h-0 flex-col", className)}>
      {children}
    </div>
  );
}

export function WriterPageGridQuarter({ children, className, fillHeight }: WriterPageColumnProps) {
  return (
    <div
      className={cn(
        "w-full min-w-0 lg:max-w-sm",
        fillHeight && "flex h-full min-h-0 flex-col",
        className
      )}
    >
      {children}
    </div>
  );
}

type WriterPageGridThirdProps = WriterPageColumnProps & {
  position: "leading" | "center" | "trailing";
};

export function WriterPageGridThird({ children, className, fillHeight }: WriterPageGridThirdProps) {
  return (
    <div className={cn("w-full min-w-0", fillHeight && "flex h-full min-h-0 flex-col", className)}>
      {children}
    </div>
  );
}

type WriterPageStackProps = {
  children: ReactNode;
  gap?: number;
  fill?: boolean;
};

const gapClass: Record<number, string> = {
  3: "gap-3",
  4: "gap-4",
  5: "gap-5",
  6: "gap-6",
  7: "gap-8"
};

export function WriterPageStack({ children, gap = 6, fill = false }: WriterPageStackProps) {
  return (
    <div className={cn("flex flex-col", gapClass[gap] ?? "gap-6", fill && "min-h-0 flex-1")}>
      {children}
    </div>
  );
}
