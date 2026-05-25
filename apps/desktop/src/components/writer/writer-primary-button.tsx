import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const writerPrimaryButtonClassName =
  "inline-flex cursor-pointer items-center justify-center rounded-full border border-[rgb(32_131_234/0.28)] bg-[var(--writer-accent-blue)] text-sm font-medium tracking-[0.52px] text-[#e5f1ff] transition-opacity hover:opacity-90 active:opacity-75 disabled:cursor-not-allowed disabled:opacity-50";

export function WriterPrimaryButton({
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cn(writerPrimaryButtonClassName, "px-4 py-2.5", className)} {...props} />
  );
}
