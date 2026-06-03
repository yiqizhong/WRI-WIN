import { BookOpen, ChevronRight, MessageCircle } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { GlassCard } from "@/components/writer/glass-card";
import { cn } from "@/lib/utils";
import {
  WriterPrimaryButton,
  writerPrimaryButtonMotionEndClassName
} from "@/components/writer/writer-primary-button";
import { useWorkspace } from "../workspace-context";

const FIGMA_LOGO = `${import.meta.env.BASE_URL}mcp-server-logos/figma.png`;
const WORKFLOW_CARD_ICON_CLASS = "size-10";

function WorkflowCardIcon({ children }: { children: ReactNode }) {
  return (
    <div
      className={`flex ${WORKFLOW_CARD_ICON_CLASS} shrink-0 items-center justify-center overflow-hidden`}
      aria-hidden
    >
      {children}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning!";
  if (h < 18) return "Good afternoon!";
  return "Good evening!";
}

type WorkflowCardProps = {
  type: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  typeSize?: string;
  typeLeading?: string;
};

function WorkflowCard({
  type,
  description,
  icon,
  onClick,
  typeSize = "68px",
  typeLeading = "80px"
}: WorkflowCardProps) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  }

  return (
    <GlassCard
      variant="filled"
      className="flex shrink-0 flex-col items-start justify-between"
      style={{ width: 320, height: 320, padding: "14.606px 23.512px 24px" }}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${type}: ${description}`}
    >
      <div className="flex flex-col gap-2">
        <p
          className="writer-home-text writer-home-card-display"
          style={{ fontSize: typeSize, lineHeight: typeLeading }}
        >
          {type}
        </p>
        <p className="writer-home-section-description mt-1 max-w-[260px]">{description}</p>
      </div>
      <div className="flex w-full items-end justify-between gap-auto">
        {icon}
        <WriterPrimaryButton
          className={cn("w-[100px] px-1.5 py-3", writerPrimaryButtonMotionEndClassName)}
          aria-label="Go"
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
        >
          <ChevronRight className="size-5" strokeWidth={2} aria-hidden />
        </WriterPrimaryButton>
      </div>
    </GlassCard>
  );
}

export function HomeScreen() {
  const navigate = useNavigate();
  const { userName } = useWorkspace();
  const name = userName;

  return (
    <div className="writer-content-fade-in mt-[76px] flex h-full w-full items-center justify-center">
      <div className="flex -translate-y-[108px] flex-col gap-16">
        <div className="flex flex-col gap-6">
          <div className="writer-home-text writer-home-heading flex flex-col">
            <span>{name ? `Hi ${name},` : "Hi,"}</span>
            <span>{greeting()}</span>
          </div>
          <div className="writer-home-divider" aria-hidden />
        </div>

        <div className="flex gap-6">
          <WorkflowCard
            type="Figma"
            description="Audit frames in Figma and write approved edits back."
            icon={
              <WorkflowCardIcon>
                <img
                  src={FIGMA_LOGO}
                  alt=""
                  draggable={false}
                  className="relative size-full -translate-x-[3px] object-cover object-center opacity-65"
                />
              </WorkflowCardIcon>
            }
            onClick={() => navigate("/figma-audit")}
          />
          <WorkflowCard
            type="Chat"
            description="Paste copy for a quick rewrite in chat."
            icon={
              <WorkflowCardIcon>
                <MessageCircle className="size-7 text-[#e5f1ff]/75" strokeWidth={1.25} aria-hidden />
              </WorkflowCardIcon>
            }
            onClick={() => navigate("/text-copy")}
          />
          <WorkflowCard
            type="Guide"
            description="Generate background, glossary, and writing-guide files from Figma."
            icon={
              <WorkflowCardIcon>
                <BookOpen className="size-7 text-[#e5f1ff]/75" strokeWidth={1.25} aria-hidden />
              </WorkflowCardIcon>
            }
            onClick={() => navigate("/guide")}
          />
        </div>
      </div>
    </div>
  );
}
