import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WriterDialogCloseProps = {
  onClick: () => void;
  className?: string;
  label?: string;
};

export function WriterDialogClose({ onClick, className, label = "Close" }: WriterDialogCloseProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        "shrink-0 text-[var(--writer-accent-orange)] hover:bg-[rgb(230_127_1/0.14)] hover:text-[var(--writer-accent-orange)]",
        className
      )}
      aria-label={label}
      onClick={onClick}
    >
      <X className="size-4" strokeWidth={1.5} aria-hidden />
    </Button>
  );
}
