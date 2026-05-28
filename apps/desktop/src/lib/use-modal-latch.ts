import { useEffect, useState } from "react";

/**
 * Snapshots `value` every time `open` is true. When `open` flips to false,
 * the last snapshot is returned unchanged — keeping modal content visually
 * stable for the entire duration of the CSS exit animation.
 *
 * This is the standard content-stability primitive for all Writer modals.
 * Consumers may clear parent state immediately in `onOpenChange`; call this
 * hook on any prop derived from that state to freeze it through the close.
 *
 * @example
 * // In a modal component:
 * const latchedTitle   = useModalLatch(open, title);
 * const latchedSummary = useModalLatch(open, summary);
 * // Both stay frozen when open becomes false — no ghost text, no content flicker.
 */
export function useModalLatch<T>(open: boolean, value: T): T {
  const [latched, setLatched] = useState<T>(value);

  useEffect(() => {
    if (!open) return;
    setLatched(value);
  }, [open, value]);

  return latched;
}
