import { WriterModal } from "@/components/writer/writer-modal";
import { WriterPageStack } from "@/layout/writer-grid";
import { useModalLatch } from "@/lib/use-modal-latch";

type AuditDetailRuleModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layerLabel: string;
  original: string;
  aiSuggestion: string;
  rationale?: string;
};

function splitRationaleLines(rationale: string | undefined): string[] {
  if (!rationale) {
    return [];
  }

  return rationale
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, ""))
    .filter(Boolean);
}

function buildTraceBullets({
  original,
  aiSuggestion,
  rationale
}: {
  original: string;
  aiSuggestion: string;
  rationale?: string;
}): string[] {
  const rationaleLines = splitRationaleLines(rationale);
  const unchanged = original.trim() === aiSuggestion.trim();
  const bullets: string[] = [];

  if (unchanged) {
    bullets.push("Assessment: No changes suggested for this copy.");
    bullets.push(
      rationaleLines[0]
        ? rationaleLines[0]
        : "Automated rule checks found no issues with this copy."
    );
  } else {
    bullets.push("Assessment: A revision is suggested for this copy.");
    bullets.push(
      rationaleLines[0]
        ? `Why: ${rationaleLines[0]}`
        : "The current copy can better align with the active writing rules."
    );
  }

  const extraLines = rationaleLines.slice(1);
  if (extraLines.length > 0) {
    bullets.push(...extraLines);
  }

  return bullets;
}

export function AuditDetailRuleModal({
  open,
  onOpenChange,
  layerLabel,
  original,
  aiSuggestion,
  rationale
}: AuditDetailRuleModalProps) {
  // Latch each prop individually so bullet text stays frozen during the exit animation
  // even if the parent clears state immediately in onOpenChange.
  const latchedOriginal = useModalLatch(open, original);
  const latchedAiSuggestion = useModalLatch(open, aiSuggestion);
  const latchedRationale = useModalLatch(open, rationale);

  const bullets = buildTraceBullets({
    original: latchedOriginal,
    aiSuggestion: latchedAiSuggestion,
    rationale: latchedRationale
  });

  return (
    <WriterModal open={open} onOpenChange={onOpenChange} title={layerLabel}>
      <WriterPageStack gap={4}>
        <ul className="m-0 list-disc space-y-2 pl-5">
          {bullets.map((bullet, index) => (
            <li key={`${index}-${bullet}`} className="writer-home-text text-sm text-[#c7d4e6]">
              {bullet}
            </li>
          ))}
        </ul>
      </WriterPageStack>
    </WriterModal>
  );
}
