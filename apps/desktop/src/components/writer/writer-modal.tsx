import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WriterDialogClose } from "@/components/writer/writer-dialog-close";
import { cn } from "@/lib/utils";

export type WriterModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Actions aligned to the footer right (e.g. Delete, Save). */
  footer?: ReactNode;
  contentClassName?: string;
};

/**
 * Writer shell modal — fixed chrome: title + close (X) header, scrollable body, right-aligned footer.
 */
export function WriterModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  contentClassName,
}: WriterModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={contentClassName}>
        <div
          className={cn(
            "writer-modal-header",
            description ? "writer-modal-header--with-description" : null,
          )}
        >
          <DialogHeader className="writer-modal-header__text">
            <DialogTitle className="writer-modal-header__title">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="writer-modal-header__description">
                {description}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <WriterDialogClose onClick={() => onOpenChange(false)} />
        </div>

        {children ? (
          <div className="writer-modal-surface__scroll">{children}</div>
        ) : null}

        {footer ? (
          <DialogFooter className="writer-modal-footer">{footer}</DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
