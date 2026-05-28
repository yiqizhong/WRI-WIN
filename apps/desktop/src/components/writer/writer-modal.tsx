import { type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WriterDialogClose } from "@/components/writer/writer-dialog-close";
import { useModalLatch } from "@/lib/use-modal-latch";
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
 * **The standard modal shell for the entire Writer app.**
 *
 * Every dialog in the app must use this component. It provides:
 * - Fixed chrome: title + close (×) header, scrollable body, right-aligned footer.
 * - 600ms Apple-style enter/exit animation (opacity + 8 px translateY) via CSS,
 *   driven by Base UI's `data-open` / `data-closed` attributes.
 * - Content stability: `title`, `description`, and `footer` are latched via
 *   `useModalLatch` so they stay frozen during the exit animation even when the
 *   parent clears state immediately in `onOpenChange`.
 *
 * ### Content stability contract
 * Parent state may be cleared synchronously inside `onOpenChange`:
 * ```tsx
 * onOpenChange={(open) => { if (!open) setMyData(null); }}
 * ```
 * `WriterModal` guarantees its own header and footer remain visible throughout
 * the closing animation. For **dynamic body content** derived from parent state,
 * each modal component should call `useModalLatch` on those props:
 * ```tsx
 * const latchedName = useModalLatch(open, name);
 * ```
 *
 * ### Example
 * ```tsx
 * <WriterModal
 *   open={open}
 *   onOpenChange={(open) => { if (!open) setData(null); }}
 *   title="My dialog"
 *   footer={<WriterPrimaryButton onClick={handleSave}>Save</WriterPrimaryButton>}
 * >
 *   <p>Body content here</p>
 * </WriterModal>
 * ```
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
  const latchedTitle = useModalLatch(open, title);
  const latchedDescription = useModalLatch(open, description);
  const latchedFooter = useModalLatch(open, footer);

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

        {latchedFooter ? (
          <DialogFooter className="writer-modal-footer">{latchedFooter}</DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
