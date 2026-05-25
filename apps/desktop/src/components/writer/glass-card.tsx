import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

import "./glass-card.css";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function GlassCard({ children, className, style }: GlassCardProps) {
  return (
    <div className={cn("glass-card", className)} style={style}>
      {children}
    </div>
  );
}
