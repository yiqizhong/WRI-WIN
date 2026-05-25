import { useNavigate } from "react-router-dom";

import { GlassCard } from "@/components/writer/glass-card";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";


function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning!";
  if (h < 18) return "Good afternoon!";
  return "Good evening!";
}

type WorkflowCardProps = {
  type: string;
  label: string;
  onClick: () => void;
  typeSize?: string;
  typeLeading?: string;
};

function WorkflowCard({ type, label, onClick, typeSize = "68px", typeLeading = "80px" }: WorkflowCardProps) {
  return (
    <GlassCard
      variant="filled"
      className="flex shrink-0 flex-col items-start justify-between"
      style={{ width: 320, height: 320, padding: "14.606px 23.512px 24px" }}
    >
      <div className="flex flex-col gap-2">
        <p className="writer-home-text writer-home-card-display" style={{ fontSize: typeSize, lineHeight: typeLeading }}>
          {type}
        </p>
        <p className="writer-home-text writer-home-card-label">{label}</p>
      </div>
      <div className="flex w-full justify-end">
        <WriterPrimaryButton className="w-[100px] px-1.5 py-3" onClick={onClick}>
          Go
        </WriterPrimaryButton>
      </div>
    </GlassCard>
  );
}

export function HomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="mt-[76px] flex h-full w-full items-center justify-center">
      <div className="flex flex-col gap-16">
        {/* Greeting */}
        <div className="flex flex-col gap-6">
          <div className="writer-home-text writer-home-heading flex flex-col">
            <span>Hi, Alex</span>
            <span>{greeting()}</span>
          </div>
          <div className="writer-home-divider" aria-hidden />
        </div>

        {/* Cards */}
        <div className="flex gap-[90px]">
          <WorkflowCard
            type="Figma"
            label="Copy"
            onClick={() => navigate("/settings?tab=sources")}
          />
          <WorkflowCard
            type="Text"
            label="Copy"
            onClick={() => navigate("/text-copy")}
          />
        </div>
      </div>
    </div>
  );
}
