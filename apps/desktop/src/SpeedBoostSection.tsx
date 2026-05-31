import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { InlineAlert } from "@/components/writer/inline-alert";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";
import { WriterSwitch } from "@/components/writer/writer-switch";

export type DraftStatus = {
  installed: boolean;
  enabled: boolean;
  lastError?: string;
};

/** Pure function — drives rendering logic. Exported for testing. */
export function deriveSpeedBoostState(status: DraftStatus): {
  showInstall: boolean;
  showToggle: boolean;
  showBanner: boolean;
} {
  return {
    showInstall: !status.installed,
    showToggle: status.installed,
    showBanner: !!status.lastError
  };
}

export type SpeedBoostSectionProps = {
  status: DraftStatus;
  installing?: boolean;
  onInstall: () => void;
  onToggle: (next: boolean) => void;
};

export function SpeedBoostSection({ status, installing, onInstall, onToggle }: SpeedBoostSectionProps) {
  const { showInstall, showToggle, showBanner } = deriveSpeedBoostState(status);

  return (
    <section aria-label="Speed boost" className="flex flex-col gap-2 border-t border-[#e5f1ff]/10 pt-3">
      <p className="text-xs font-medium tracking-wide text-[#e5f1ff]/60 uppercase">Speed boost</p>

      {showInstall && (
        <WriterPrimaryButton
          disabled={installing}
          onClick={onInstall}
          className="w-full justify-center"
        >
          {installing ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Installing…
            </span>
          ) : (
            "Install draft model (~500 MB)"
          )}
        </WriterPrimaryButton>
      )}

      {showToggle && (
        <div className="flex items-center justify-between">
          <Label htmlFor="speed-boost-toggle" className="writer-home-text text-sm font-extralight">
            Speculative decoding
          </Label>
          <WriterSwitch
            id="speed-boost-toggle"
            checked={status.enabled}
            aria-label="Speculative decoding"
            onCheckedChange={onToggle}
          />
        </div>
      )}

      {showBanner && status.lastError && (
        <InlineAlert kind="error" title="Not available" subtitle={status.lastError} />
      )}
    </section>
  );
}
