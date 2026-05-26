import { useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import "./writer-star-border.css";

type WriterStarBorderProps = {
  children: ReactNode;
  className?: string;
  /** Seconds for one full clockwise turn (linear, constant speed) */
  lapDuration?: number;
  loops?: number;
  thickness?: number;
  /** Skip intro beam; show static glass stroke (post-welcome / active chat composer) */
  skipIntro?: boolean;
};

const BEAM_FADE_SEC = 0.4;
const STROKE_FADE_SEC = 0.35;
const STROKE_FADE_START_BEFORE_END_SEC = 1.4;

export function WriterStarBorder({
  children,
  className,
  lapDuration = 2.5,
  loops = 1,
  thickness = 1.5,
  skipIntro = false
}: WriterStarBorderProps) {
  const [introDone, setIntroDone] = useState(skipIntro);
  const rotateSec = lapDuration * loops;
  const beamFadeDelaySec = Math.max(0, rotateSec - BEAM_FADE_SEC);
  const strokeFadeDelaySec = Math.max(
    0,
    rotateSec - STROKE_FADE_START_BEFORE_END_SEC
  );
  const totalMs = Math.round((rotateSec + STROKE_FADE_SEC) * 1000);

  useLayoutEffect(() => {
    if (skipIntro) {
      setIntroDone(true);
    }
  }, [skipIntro]);

  useEffect(() => {
    if (skipIntro) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIntroDone(true);
      return;
    }

    const fallback = window.setTimeout(() => setIntroDone(true), totalMs + 50);
    return () => window.clearTimeout(fallback);
  }, [totalMs, skipIntro]);

  const style = {
    "--writer-star-duration": `${rotateSec}s`,
    "--writer-star-loops": loops,
    "--writer-star-thickness": `${thickness}px`,
    "--writer-star-beam-fade-duration": `${BEAM_FADE_SEC}s`,
    "--writer-star-beam-fade-delay": `${beamFadeDelaySec}s`,
    "--writer-star-stroke-fade-duration": `${STROKE_FADE_SEC}s`,
    "--writer-star-stroke-fade-delay": `${strokeFadeDelaySec}s`
  } as CSSProperties;

  return (
    <div
      className={cn(
        "writer-star-border",
        introDone && "writer-star-border--idle",
        className
      )}
      style={style}
    >
      <div className="writer-star-border__ring" aria-hidden={introDone}>
        <div className="writer-star-border__spin" />
      </div>
      <div className="writer-star-border__inner">{children}</div>
    </div>
  );
}
