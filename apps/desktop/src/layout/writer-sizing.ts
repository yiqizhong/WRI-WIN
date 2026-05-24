import { cn } from "@/lib/utils";

export function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const hugWidth = "w-fit";
export const hugHeight = "h-fit";
export const fillWidth = "w-full";
export const row = "flex flex-row items-center gap-2";
export const rowBetween = "flex flex-row items-center justify-between gap-2";
export const rowEnd = "flex flex-row items-center justify-end gap-2";
export const surface = "text-card-foreground";
export const surfaceFillHeight = "flex h-full min-h-0 flex-col";
export const surfaceBody = "min-h-0 flex-1 overflow-hidden";

export function gridCell(fillHeight?: boolean) {
  return cn("min-w-0", fillHeight && "flex h-full min-h-0 flex-col");
}

export const stackFill = "min-h-0 flex-1";

export const chatBubble = "rounded-lg border bg-muted/50 px-3 py-2 text-sm";
export const chatBubbleEnd = "ml-auto max-w-[85%] rounded-lg border bg-primary/10 px-3 py-2 text-sm";
