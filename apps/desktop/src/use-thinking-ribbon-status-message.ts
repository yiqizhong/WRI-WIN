import { useEffect, useState } from "react";

import {
  pickThinkingRibbonStatusMessage,
  THINKING_RIBBON_ROTATE_MS
} from "./text-copy-thinking-ribbon";

export function useThinkingRibbonStatusMessage(active: boolean): string {
  const [message, setMessage] = useState(() => pickThinkingRibbonStatusMessage());

  useEffect(() => {
    if (!active) {
      return;
    }

    setMessage(pickThinkingRibbonStatusMessage());

    const id = window.setInterval(() => {
      setMessage((current) => pickThinkingRibbonStatusMessage(current));
    }, THINKING_RIBBON_ROTATE_MS);

    return () => {
      window.clearInterval(id);
    };
  }, [active]);

  return message;
}
