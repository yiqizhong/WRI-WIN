import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const writerPrimaryButtonClassName =
  "writer-primary-button inline-flex cursor-pointer items-center justify-center rounded-full border border-[rgb(32_131_234/0.28)] bg-[var(--writer-accent-blue)] text-sm font-medium tracking-normal text-[#e5f1ff] disabled:cursor-not-allowed disabled:opacity-50";

/** Chevron / forward icons — horizontal nudge on hover */
export const writerPrimaryButtonMotionEndClassName = "writer-primary-button--motion-end";

export function WriterPrimaryButton({
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cn(writerPrimaryButtonClassName, "px-4 py-2.5", className)} {...props} />
  );
}
