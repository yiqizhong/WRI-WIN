import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { GlassCard } from "@/components/writer/glass-card";
import { cn } from "@/lib/utils";

import { WriterPageStack } from "./writer-grid";
import { WriterSectionHeader } from "./writer-headings";

export function WorkflowBackLink({ to = "/", label = "Back" }: { to?: string; label?: string }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="writer-home-text inline-flex w-fit shrink-0 cursor-pointer items-center gap-2 rounded-md py-1 text-sm font-normal tracking-normal text-[#e5f1ff]/75 transition-colors hover:text-[#e5f1ff]"
      aria-label={label === "Back" ? "Back to home" : label}
    >
      <ArrowLeft className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
      {label}
    </button>
  );
}

export function WorkflowScreenShell({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto pb-5",
        className
      )}
    >
      <WriterPageStack gap={4}>{children}</WriterPageStack>
    </div>
  );
}

export function WorkflowPageIntro({
  title,
  description,
  actions
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return <WriterSectionHeader title={title} description={description} actions={actions} />;
}

export function WorkflowGlassPanel({
  title,
  description,
  actions,
  children,
  className,
  fillHeight
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  fillHeight?: boolean;
}) {
  return (
    <GlassCard
      variant="outline"
      className={cn(
        "flex flex-col gap-4 p-4",
        fillHeight && "min-h-0 flex-1",
        className
      )}
    >
      {title ? (
        <WriterSectionHeader title={title} description={description} actions={actions} />
      ) : null}
      {children}
    </GlassCard>
  );
}
