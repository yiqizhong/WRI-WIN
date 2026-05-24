import type { ResolvedGuideline } from "../inheritance";
import { InMemoryFullScanIndex } from "./full-scan-index";
import type { GuidelineIndex } from "./types";

const RULE_COUNT_WARN = 200;
const PROSE_BYTES_WARN = 50 * 1024;

export type CorpusWarning = { ruleCount: number; proseBytes: number };

export function buildIndex(
  guidelines: ResolvedGuideline[],
  onWarning?: (w: CorpusWarning) => void
): GuidelineIndex {
  const ruleCount = guidelines.reduce((n, g) => n + g.rules.length, 0);
  const proseBytes = guidelines.reduce(
    (n, g) => n + ((g as unknown as { _prose?: string })._prose?.length ?? 0),
    0
  );

  if (onWarning && (ruleCount >= RULE_COUNT_WARN || proseBytes >= PROSE_BYTES_WARN)) {
    onWarning({ ruleCount, proseBytes });
  }

  return new InMemoryFullScanIndex(guidelines);
}
