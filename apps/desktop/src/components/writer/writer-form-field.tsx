import type { ComponentProps, ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { GlassCard } from "./glass-card";

import "../../styles/writer-form-field.css";

export function WriterFormField({
  label,
  htmlFor,
  hint,
  children,
  className
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={htmlFor} className="writer-home-text text-sm text-[#e5f1ff]/80">
        {label}
      </Label>
      {hint ? <p className="m-0 text-sm text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
  );
}

type WriterFormInputProps = ComponentProps<typeof Input> & {
  shellClassName?: string;
  variant?: "default" | "title";
};

export function WriterFormInput({
  className,
  shellClassName,
  variant = "default",
  ...props
}: WriterFormInputProps) {
  return (
    <GlassCard
      variant="outline"
      className={cn(
        "flex items-center px-4 py-2.5",
        variant === "title" ? "min-h-[61px]" : "min-h-[44px]",
        shellClassName
      )}
    >
      <Input
        className={cn(
          "flex-1",
          variant === "title" ? "writer-modal-id-field" : "writer-form-control",
          className
        )}
        {...props}
      />
    </GlassCard>
  );
}

type WriterFormTextareaProps = ComponentProps<typeof Textarea> & {
  shellClassName?: string;
};

export function WriterFormTextarea({ className, shellClassName, rows = 4, ...props }: WriterFormTextareaProps) {
  return (
    <GlassCard
      variant="outline"
      className={cn("flex min-h-[120px] items-stretch px-4 py-2.5", shellClassName)}
    >
      <Textarea
        rows={rows}
        className={cn("writer-form-control writer-form-control--textarea flex-1", className)}
        {...props}
      />
    </GlassCard>
  );
}

export type WriterFormSelectOption = {
  value: string;
  label: string;
};

type WriterFormSelectProps = {
  id?: string;
  value: string;
  options: WriterFormSelectOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  displayValue: string;
  placeholder?: string;
  contentAlign?: "start" | "center" | "end";
};

export function WriterFormSelect({
  id,
  value,
  options,
  onValueChange,
  disabled,
  displayValue,
  placeholder = "Select…",
  contentAlign = "start"
}: WriterFormSelectProps) {
  const label = displayValue.trim() || placeholder;

  return (
    <GlassCard
      variant="outline"
      className="writer-form-select-shell flex min-h-[44px] items-center px-4 py-2.5"
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          className="writer-form-select-trigger w-full min-w-0"
          render={
            <button type="button" id={id} disabled={disabled} className="writer-form-select-trigger-btn">
              <span
                className={cn(
                  "writer-form-select-trigger-label min-w-0 flex-1 truncate text-left",
                  !displayValue.trim() && "writer-form-select-trigger-label--placeholder"
                )}
              >
                {label}
              </span>
              <ChevronDown className="writer-form-select-trigger-chevron size-4 shrink-0" aria-hidden />
            </button>
          }
        />
        <DropdownMenuContent align={contentAlign} className="writer-product-menu">
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              disabled={disabled}
              onClick={() => onValueChange(option.value)}
              className={cn(
                "writer-product-menu-item",
                value === option.value && "writer-product-menu-item--selected"
              )}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </GlassCard>
  );
}
