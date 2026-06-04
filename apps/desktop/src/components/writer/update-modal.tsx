import type { ReactNode } from "react";
import type { AppUpdateState } from "@writer/contracts";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const gb = bytes / 1_073_741_824;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1_048_576;
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  const kb = bytes / 1_024;
  return `${kb.toFixed(0)} KB`;
}
import { WriterModal } from "@/components/writer/writer-modal";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";
import { useModalLatch } from "@/lib/use-modal-latch";

type UpdateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: AppUpdateState;
  onDownload: () => void;
  onRestart: () => void;
  onRetry: () => void;
};

export function UpdateModal({
  open,
  onOpenChange,
  state,
  onDownload,
  onRestart,
  onRetry,
}: UpdateModalProps) {
  const s = useModalLatch(open, state);

  return (
    <WriterModal
      open={open}
      onOpenChange={onOpenChange}
      title={resolveTitle(s)}
      footer={resolveFooter(s, { onOpenChange, onDownload, onRestart, onRetry })}
    >
      {resolveBody(s)}
    </WriterModal>
  );
}

function resolveTitle(s: AppUpdateState): string {
  switch (s.status) {
    case "available":   return `Writer ${s.version} is available`;
    case "downloading": return "Downloading update…";
    case "downloaded":  return "Update ready";
    case "error":       return "Update failed";
    default:            return "App updates";
  }
}

function resolveBody(s: AppUpdateState): ReactNode {
  const muted = "text-sm text-[#e5f1ff]/70";
  switch (s.status) {
    case "available":
      return (
        <div className="flex flex-col gap-3">
          {s.releaseNotes ? (
            <div className="rounded-[2px] bg-white/5 px-3 py-2.5 text-sm text-[#e5f1ff]/80 whitespace-pre-wrap leading-relaxed">
              {s.releaseNotes}
            </div>
          ) : (
            <p className={muted}>A new version of Writer is ready to download.</p>
          )}
          <p className="text-xs text-[#e5f1ff]/40">Your data and models will not be affected.</p>
        </div>
      );
    case "downloading": {
      const hasBytes = (s.totalBytes ?? 0) > 0;
      return (
        <div className="flex flex-col gap-1.5">
          <div
            role="progressbar"
            aria-valuenow={s.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Download progress"
            className="flex w-full items-center gap-1"
          >
            <div
              className="h-[3.8px] min-w-px rounded-[0.95px] bg-[linear-gradient(to_right,#3b4df2,#bafde6_94.712%,white)] transition-[flex] duration-500 ease-linear"
              style={{ flex: s.percent }}
            />
            <div
              className="h-[3.8px] min-w-px rounded-[0.95px] bg-[#666] transition-[flex] duration-500 ease-linear"
              style={{ flex: 100 - s.percent }}
            />
          </div>
          <p className="text-xs text-[#e5f1ff]/50">
            {hasBytes
              ? `${s.percent}% · ${formatBytes(s.transferredBytes ?? 0)} / ${formatBytes(s.totalBytes!)}`
              : `${s.percent}%`}
          </p>
        </div>
      );
    }
    case "downloaded":
      return <p className={muted}>Writer will restart and reopen automatically.</p>;
    case "error":
      return <p className={muted}>{s.message}</p>;
    default:
      return null;
  }
}

function SecondaryBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2.5 text-sm font-medium text-[#e5f1ff]/60 transition-colors hover:text-[#e5f1ff]"
    >
      {children}
    </button>
  );
}

function resolveFooter(
  s: AppUpdateState,
  handlers: {
    onOpenChange: (open: boolean) => void;
    onDownload: () => void;
    onRestart: () => void;
    onRetry: () => void;
  }
): ReactNode {
  const { onOpenChange, onDownload, onRestart, onRetry } = handlers;
  const dismiss = () => onOpenChange(false);
  switch (s.status) {
    case "available":
      return (
        <>
          <SecondaryBtn onClick={dismiss}>Not now</SecondaryBtn>
          <WriterPrimaryButton onClick={onDownload}>Upgrade</WriterPrimaryButton>
        </>
      );
    case "downloading":
      return <SecondaryBtn onClick={dismiss}>Download in background</SecondaryBtn>;
    case "downloaded":
      return (
        <>
          <SecondaryBtn onClick={dismiss}>Later</SecondaryBtn>
          <WriterPrimaryButton onClick={onRestart}>Restart to install</WriterPrimaryButton>
        </>
      );
    case "error":
      return (
        <>
          <SecondaryBtn onClick={dismiss}>Dismiss</SecondaryBtn>
          <WriterPrimaryButton onClick={onRetry}>Try again</WriterPrimaryButton>
        </>
      );
    default:
      return null;
  }
}
