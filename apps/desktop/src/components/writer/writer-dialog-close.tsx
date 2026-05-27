import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WriterDialogCloseProps = {
  onClick?: () => void;
  className?: string;
  "aria-label"?: string;
};

export function WriterDialogClose({
  onClick,
  className,
  "aria-label": ariaLabel = "Close",
}: WriterDialogCloseProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "writer-pill-ghost writer-pill-ghost--close-icon size-8 shrink-0",
        className,
      )}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <X className="size-4" />
      <span className="sr-only">Close</span>
    </Button>
  );
}
