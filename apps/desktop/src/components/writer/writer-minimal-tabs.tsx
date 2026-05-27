import type { ReactNode } from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** Matches Settings → Writing Guidelines / LLM & MCP tab triggers. */
export const WRITER_MINIMAL_TAB_TRIGGER_CLASS = cn(
  "transition-none",
  "group-data-[variant=minimal]/tabs-list:!text-[rgb(229_241_255/58%)]",
  "dark:group-data-[variant=minimal]/tabs-list:!text-[rgb(229_241_255/58%)]",
  "group-data-[variant=minimal]/tabs-list:hover:!text-[rgb(229_241_255/82%)]",
  "dark:group-data-[variant=minimal]/tabs-list:hover:!text-[rgb(229_241_255/82%)]",
  "group-data-[variant=minimal]/tabs-list:data-active:!text-[var(--writer-accent-blue)]",
  "dark:group-data-[variant=minimal]/tabs-list:data-active:!text-[var(--writer-accent-blue)]",
  "group-data-[variant=minimal]/tabs-list:data-active:hover:!text-[var(--writer-accent-blue)]",
  "dark:group-data-[variant=minimal]/tabs-list:data-active:hover:!text-[var(--writer-accent-blue)]"
);

export function WriterMinimalTabsList({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <TabsList
      variant="minimal"
      className={cn("writer-settings-tabs-list relative z-[1] max-w-full shrink-0", className)}
    >
      {children}
      <TabsPrimitive.Indicator className="writer-settings-tab-indicator" />
    </TabsList>
  );
}
