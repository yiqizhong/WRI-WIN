import { useEffect, useState, type ReactNode } from "react";

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
  // Keep header copy stable while the exit animation runs (parents often clear data in onOpenChange).
  const [latchedTitle, setLatchedTitle] = useState(title);
  const [latchedDescription, setLatchedDescription] = useState(description);

  useEffect(() => {
    if (!open) return;
    setLatchedTitle(title);
    setLatchedDescription(description);
  }, [open, title, description]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={contentClassName}>
        <div
          className={cn(
            "writer-modal-header",
            latchedDescription ? "writer-modal-header--with-description" : null,
          )}
        >
          <DialogHeader className="writer-modal-header__text">
            <DialogTitle className="writer-modal-header__title">{latchedTitle}</DialogTitle>
            {latchedDescription ? (
              <DialogDescription className="writer-modal-header__description">
                {latchedDescription}
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
