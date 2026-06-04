import { Loader2 } from "lucide-react";
import type { AppUpdateState } from "@writer/contracts";
import { cn } from "@/lib/utils";

export function pillLabel(state: AppUpdateState): string | null {
  switch (state.status) {
    case "available":   return "Upgrade";
    case "downloading": return "Downloading…";
    case "downloaded":  return "Update ready";
    case "error":       return "Update failed";
    default:            return null;
  }
}

export type PillVariant = "blue" | "gray" | "green" | "warning";

export function pillVariant(state: AppUpdateState): PillVariant | null {
  switch (state.status) {
    case "available":   return "blue";
    case "downloading": return "gray";
    case "downloaded":  return "green";
    case "error":       return "warning";
    default:            return null;
  }
}

const VARIANT_CLASSES: Record<PillVariant, string> = {
  blue:    "bg-[var(--writer-accent-blue)] text-[#e5f1ff] hover:opacity-90",
  gray:    "bg-white/10 text-[#e5f1ff]/50 hover:bg-white/15 cursor-pointer",
  green:   "bg-[#1a7a4a] text-white hover:bg-[#166040]",
  warning: "bg-[#7a3010]/80 text-[#ffb89a] hover:bg-[#7a3010]",
};

type UpdatePillProps = {
  state: AppUpdateState;
  onClick: () => void;
};

export function UpdatePill({ state, onClick }: UpdatePillProps) {
  const label = pillLabel(state);
  const variant = pillVariant(state);
  if (!label || !variant) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "self-center mr-2 flex items-center gap-1.5 rounded-full px-3 py-1",
        "text-xs font-medium tracking-wide transition-opacity",
        VARIANT_CLASSES[variant]
      )}
    >
      {state.status === "downloading" && <Loader2 size={11} className="animate-spin" aria-hidden />}
      {label}
    </button>
  );
}
