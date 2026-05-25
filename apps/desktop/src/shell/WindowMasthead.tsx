import { Settings } from "lucide-react";

import "../styles/writer-masthead.css";

type WindowMastheadProps = {
  onSettings?: () => void;
};

export function WindowMasthead({ onSettings }: WindowMastheadProps) {
  const win = window.writerDesktop;

  return (
    <div className="writer-masthead">
      <div className="writer-masthead__buttons">
        {/* Settings */}
        {onSettings && (
          <button
            className="writer-masthead__btn writer-masthead__btn--settings"
            onClick={onSettings}
            aria-label="Settings"
            tabIndex={-1}
          >
            <Settings size={14} strokeWidth={1.5} />
          </button>
        )}

        {/* Minimize */}
        <button
          className="writer-masthead__btn writer-masthead__btn--minimize"
          onClick={() => win.windowMinimize()}
          aria-label="Minimize"
          tabIndex={-1}
        >
          <svg viewBox="0 0 10 1" fill="currentColor" aria-hidden>
            <rect width="10" height="1" />
          </svg>
        </button>

        {/* Maximize — disabled, window is fixed size */}
        <button
          className="writer-masthead__btn writer-masthead__btn--maximize"
          disabled
          aria-label="Maximize (unavailable)"
          tabIndex={-1}
        >
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        </button>

        {/* Close */}
        <button
          className="writer-masthead__btn writer-masthead__btn--close"
          onClick={() => win.windowClose()}
          aria-label="Close"
          tabIndex={-1}
        >
          <svg viewBox="0 0 10 10" fill="currentColor" aria-hidden>
            <polygon points="0,0 1,0 5,4 9,0 10,0 10,1 6,5 10,9 10,10 9,10 5,6 1,10 0,10 0,9 4,5 0,1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
