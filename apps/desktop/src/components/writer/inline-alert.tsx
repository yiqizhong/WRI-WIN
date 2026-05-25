import { useEffect } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const DEFAULT_AUTO_DISMISS_MS = 3000;

export function InlineAlert({
  kind,
  title,
  subtitle,
  onClose,
  autoDismissMs = onClose ? DEFAULT_AUTO_DISMISS_MS : undefined
}: {
  kind: "error" | "success" | "warning" | "info";
  title: string;
  subtitle?: string;
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

  const variant = kind === "error" ? "destructive" : "default";
  return (
    <Alert variant={variant} className="relative pr-10">
      {kind === "error" ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
      <AlertTitle>{title}</AlertTitle>
      {subtitle ? <AlertDescription>{subtitle}</AlertDescription> : null}
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
    </Alert>
  );
}
