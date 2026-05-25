import { useNavigate } from "react-router-dom";

import { GlassCard } from "@/components/writer/glass-card";


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
      className="flex shrink-0 flex-col items-start justify-between"
      style={{ width: 320, height: 320, padding: "14.606px 23.512px 24px" }}
    >
      <div className="flex flex-col gap-2">
        <p className="font-[200] tracking-[2.5px] text-[#e5f1ff]" style={{ fontSize: typeSize, lineHeight: typeLeading }}>
          {type}
        </p>
        <p className="text-[28px] font-normal leading-tight tracking-[2.5px] text-[#e5f1ff]">
          {label}
        </p>
      </div>
      <div className="flex w-full justify-end">
        <button
          onClick={onClick}
          className="flex w-[100px] cursor-pointer items-center justify-center rounded-full border border-[rgba(157,202,251,0.16)] bg-[#2083ea] px-1.5 py-3 text-sm font-medium tracking-[0.52px] text-[#e5f1ff] transition-opacity hover:opacity-90 active:opacity-75"
        >
          Go
        </button>
      </div>
    </GlassCard>
  );
}

export function HomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col gap-16" style={{ marginTop: 114 }}>
        {/* Greeting */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col text-[32px] font-normal leading-snug tracking-[2.5px] text-[#e5f1ff]">
            <span>Hi, Alex</span>
            <span>{greeting()}</span>
          </div>
          <div
            className="h-px w-full opacity-25"
            style={{ background: "linear-gradient(to left, rgba(19,42,82,0.5) 0%, rgba(32,131,234,1) 91%, rgba(19,42,82,0.5) 100%)" }}
          />
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
            onClick={() => navigate("/settings?tab=review")}
          />
        </div>
      </div>
    </div>
  );
}
