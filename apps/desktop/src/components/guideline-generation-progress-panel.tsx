import { Check, Loader2 } from "lucide-react";

import type { GuidelineProgressView } from "../guideline-generation-progress";
import { WorkflowGlassPanel } from "../layout/workflow-screen-shell";

export function GuidelineGenerationProgressPanel({ progress }: { progress: GuidelineProgressView }) {
  return (
    <WorkflowGlassPanel
      title="Generation in progress"
      description="This page refreshes automatically. Devin runs can take several minutes."
    >
      <div className="grid gap-3">
        {progress.elapsedLabel ? (
          <p className="m-0 text-sm text-[#e5f1ff]/70">{progress.elapsedLabel}</p>
        ) : null}
        {progress.detailMessage ? (
          <p className="m-0 text-sm font-medium text-[#e5f1ff]/88">{progress.detailMessage}</p>
        ) : null}
        <ol className="m-0 grid list-none gap-2 p-0">
          {progress.steps.map((step) => (
            <li
              key={step.stage}
              className="flex items-start gap-2 text-sm text-[#e5f1ff]/80"
              aria-current={step.state === "active" ? "step" : undefined}
            >
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center" aria-hidden>
                {step.state === "done" ? (
                  <Check className="size-3.5 text-emerald-300/90" strokeWidth={2.5} />
                ) : step.state === "active" ? (
                  <Loader2 className="size-3.5 animate-spin text-[#7eb8ff]" strokeWidth={2} />
                ) : (
                  <span className="size-1.5 rounded-full bg-[#e5f1ff]/25" />
                )}
              </span>
              <span className={step.state === "pending" ? "text-[#e5f1ff]/45" : undefined}>
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </WorkflowGlassPanel>
  );
}
