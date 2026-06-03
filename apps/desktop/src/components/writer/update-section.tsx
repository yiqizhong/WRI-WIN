import { useEffect, useState } from "react";
import type { AppUpdateState } from "@writer/contracts";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";

export function updateLabel(state: AppUpdateState): string {
  switch (state.status) {
    case "idle": return "Up to date";
    case "checking": return "Checking for updates…";
    case "available": return `Update available: ${state.version}`;
    case "not-available": return "You're up to date";
    case "downloading": return `Downloading… ${state.percent}%`;
    case "downloaded": return "Update ready — restart to install";
    case "error": return `Update error: ${state.message}`;
  }
}

export function UpdateSection() {
  const api = window.writerUpdate;
  const [state, setState] = useState<AppUpdateState>({ status: "idle" });

  useEffect(() => {
    if (!api) return;
    return api.onState(setState);
  }, []);

  if (!api) return null;

  return (
    <section
      aria-label="App updates"
      className="flex flex-col gap-2 border-t border-[#e5f1ff]/10 pt-3"
    >
      <p className="text-xs font-medium tracking-wide text-[#e5f1ff]/60 uppercase">App updates</p>
      <p className="text-sm text-[#e5f1ff]/80">{updateLabel(state)}</p>
      <div className="flex flex-wrap gap-2">
        <WriterPrimaryButton
          onClick={() => api.check()}
          disabled={state.status === "checking"}
        >
          Check for updates
        </WriterPrimaryButton>
        {state.status === "available" && (
          <WriterPrimaryButton onClick={() => api.download()}>
            Download
          </WriterPrimaryButton>
        )}
        {state.status === "downloaded" && (
          <WriterPrimaryButton onClick={() => api.restartToInstall()}>
            Restart to install
          </WriterPrimaryButton>
        )}
      </div>
    </section>
  );
}
