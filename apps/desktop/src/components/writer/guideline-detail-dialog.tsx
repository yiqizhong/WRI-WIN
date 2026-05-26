import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { WriterDialogClose } from "@/components/writer/writer-dialog-close";
import { cn } from "@/lib/utils";

type GuidelineDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
};

export function GuidelineDetailDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  contentClassName
}: GuidelineDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={cn("sm:max-w-lg", contentClassName)}>
        <div className="flex items-start justify-between gap-3">
          <DialogHeader className="min-w-0 flex-1 text-left">
            <DialogTitle className="writer-home-text tracking-normal">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="text-[#e5f1ff]/60">{description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <WriterDialogClose onClick={() => onOpenChange(false)} className="mt-0.5" />
        </div>
        {children}
        {footer ? <DialogFooter className="gap-2 sm:justify-between">{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
