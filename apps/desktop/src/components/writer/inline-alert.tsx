import { AlertCircle, CheckCircle2, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function InlineAlert({
  kind,
  title,
  subtitle,
  onClose
}: {
  kind: "error" | "success" | "warning" | "info";
  title: string;
  subtitle?: string;
  onClose?: () => void;
}) {
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
          className="absolute top-2 right-2 size-7"
          onClick={onClose}
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </Alert>
  );
}
