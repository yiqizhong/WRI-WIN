import { WriterModal } from "@/components/writer/writer-modal";
import { WriterPageStack } from "@/layout/writer-grid";

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
    bullets.push("Assessment: AI keeps this copy unchanged.");
    bullets.push(
      rationaleLines[0]
        ? `Why it works: ${rationaleLines[0]}`
        : "Why it works: The copy already matches the active writing rules and glossary."
    );
  } else {
    bullets.push("Assessment: AI suggests revising this copy.");
    bullets.push(
      rationaleLines[0]
        ? `Why change is needed: ${rationaleLines[0]}`
        : "Why change is needed: The current copy can better align with the active writing rules."
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
  const bullets = buildTraceBullets({ original, aiSuggestion, rationale });

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
