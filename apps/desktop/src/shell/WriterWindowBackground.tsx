import type { ReactNode } from "react";

import "../styles/writer-window-background.css";
import "../styles/writer-naked-ui.css";

type WriterWindowBackgroundProps = {
  children: ReactNode;
};

/**
 * Figma 1060:829 — 8px rounded frame, 50px glass blur, Figma tint, Blue/200 stroke.
 */
export function WriterWindowBackground({ children }: WriterWindowBackgroundProps) {
  return (
    <div className="writer-window-frame h-full w-full" data-figma-node="1060:829">
      <div className="writer-window-frame__inner">
        <div className="writer-window-frame__glass" aria-hidden />
        <div className="writer-window-frame__content">
          <div className="writer-window-frame__clip">{children}</div>
        </div>
      </div>
    </div>
  );
}
