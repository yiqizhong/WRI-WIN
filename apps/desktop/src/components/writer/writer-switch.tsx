import { cn } from "@/lib/utils";

type WriterSwitchProps = {
  id?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  "aria-label"?: string;
};

export function WriterSwitch({
  id,
  checked,
  disabled = false,
  onCheckedChange,
  className,
  "aria-label": ariaLabel
}: WriterSwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-[rgb(32_131_234/0.28)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[rgb(32_131_234/0.5)]",
        checked ? "bg-[var(--writer-accent-blue)]" : "bg-[rgba(229,241,255,0.12)]",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-[#e5f1ff] shadow-sm transition-transform",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}
