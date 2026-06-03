import { useEffect } from "react";
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const DEFAULT_AUTO_DISMISS_MS = 3000;

const KIND_STYLES = {
  error:   { border: "border-red-500/50",        bg: "bg-red-500/8",       icon: AlertCircle, iconClass: "text-red-400" },
  warning: { border: "border-[#e67f01]/60",       bg: "bg-[#e67f01]/8",     icon: AlertTriangle, iconClass: "text-[#e67f01]" },
  info:    { border: "border-[#2083ea]/50",       bg: "bg-[#2083ea]/8",     icon: Info,          iconClass: "text-[#2083ea]" },
  success: { border: "border-[#2083ea]/50",       bg: "bg-[#2083ea]/8",     icon: Info,          iconClass: "text-[#2083ea]" },
} as const;

export function InlineAlert({
  kind,
  title,
  subtitle,
  action,
  onClose,
  autoDismissMs = onClose ? DEFAULT_AUTO_DISMISS_MS : undefined
}: {
  kind: "error" | "success" | "warning" | "info";
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
  onClose?: () => void;
  /** Auto-dismiss after this many ms when `onClose` is set. Pass `0` to disable. */
  autoDismissMs?: number;
}) {
  useEffect(() => {
    if (!onClose || autoDismissMs == null || autoDismissMs <= 0) {
      return;
    }

    const timer = window.setTimeout(onClose, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [autoDismissMs, onClose, subtitle, title]);

  const { border, bg, icon: Icon, iconClass } = KIND_STYLES[kind];

  return (
    <div
      role="alert"
      className={cn(
        "relative flex items-start gap-3 rounded-[2px] border p-4",
        border,
        bg,
        onClose && "pr-10"
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconClass)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? (
          <p className="text-sm font-medium leading-snug text-[#e5f1ff]">{title}</p>
        ) : null}
        {subtitle ? (
          <p className={cn("text-sm leading-snug text-[#e5f1ff]/60", title && "mt-0.5")}>{subtitle}</p>
        ) : null}
        {action ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-7 text-xs"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ) : null}
      </div>
      {onClose ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 size-7 rounded-full"
          onClick={onClose}
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
