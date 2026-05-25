import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";

import "./glass-card.css";

type GlassCardVariant = "filled" | "outline";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Filled gradient background — use on Home workflow cards only. */
  variant?: GlassCardVariant;
  selected?: boolean;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  role?: string;
  tabIndex?: number;
  "aria-label"?: string;
};

export function GlassCard({
  children,
  className,
  style,
  variant = "outline",
  selected = false,
  onClick,
  onKeyDown,
  role,
  tabIndex,
  "aria-label": ariaLabel
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass-card",
        variant === "filled" && "glass-card--filled",
        selected && "glass-card--selected",
        onClick && "glass-card--interactive cursor-pointer",
        className
      )}
      style={style}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={role}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
