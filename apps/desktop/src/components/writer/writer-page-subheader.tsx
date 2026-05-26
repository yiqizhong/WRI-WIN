import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

type WriterPageSubheaderProps = {
  title: string;
  backTo: string;
  backLabel?: string;
  trailing?: ReactNode;
};

/** Title + back row under the window masthead (matches chat / text-copy chrome). */
export function WriterPageSubheader({
  title,
  backTo,
  backLabel = "Go back",
  trailing
}: WriterPageSubheaderProps) {
  const navigate = useNavigate();

  return (
    <div className="writer-chat-subheader shrink-0">
      <div className="writer-chat-subheader__row">
        <div className="writer-chat-subheader__lead">
          <button
            type="button"
            className="writer-chat-subheader__back"
            onClick={() => navigate(backTo)}
            aria-label={backLabel}
          >
            <ChevronLeft className="writer-chat-subheader__back-icon shrink-0" strokeWidth={1.75} aria-hidden />
          </button>
          <p className="writer-chat-subheader__title writer-home-text writer-home-section-title truncate tracking-normal">
            {title}
          </p>
        </div>
        {trailing}
      </div>
      <div className="writer-home-divider writer-chat-subheader__divider" aria-hidden />
    </div>
  );
}
