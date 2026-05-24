import { randomUUID } from "node:crypto";

import type { GuidelineSnapshot, Surface, UxCopyFinding } from "@writer/contracts";

export type DropReason = "invalid_rule_id" | "invalid_term_id" | "evidence_not_found";

export type ValidatedFinding = { finding: UxCopyFinding; dropped: false } | { dropped: true; reason: DropReason; findingId: string };

export type AuditRunSummary = {
  emittedCount: number;
  droppedCount: number;
  droppedByReason: Record<DropReason, number>;
};

export function validateFindings(
  findings: UxCopyFinding[],
  snapshot: GuidelineSnapshot,
  auditedText: string
): { validated: UxCopyFinding[]; summary: AuditRunSummary } {
  const ruleIds = new Set(snapshot.guideline.rules.map((r) => r.id));
  const termIds = new Set(snapshot.guideline.glossary.map((t) => t.id));

  const droppedByReason: Record<DropReason, number> = {
    invalid_rule_id: 0,
    invalid_term_id: 0,
    evidence_not_found: 0
  };

  const validated: UxCopyFinding[] = [];

  for (const finding of findings) {
    if (finding.ruleId !== undefined && !ruleIds.has(finding.ruleId)) {
      droppedByReason.invalid_rule_id++;
      continue;
    }
    if (finding.termId !== undefined && !termIds.has(finding.termId)) {
      droppedByReason.invalid_term_id++;
      continue;
    }
    if (finding.evidence !== undefined && !auditedText.includes(finding.evidence.quote)) {
      droppedByReason.evidence_not_found++;
      continue;
    }
    validated.push(finding);
  }

  const droppedCount = Object.values(droppedByReason).reduce((a, b) => a + b, 0);

  return {
    validated,
    summary: {
      emittedCount: validated.length,
      droppedCount,
      droppedByReason
    }
  };
}

export function buildGlossaryFindings(
  sessionId: string,
  sourceId: string,
  sourceType: UxCopyFinding["sourceType"],
  surface: Surface,
  auditedText: string,
  snapshot: GuidelineSnapshot
): UxCopyFinding[] {
  const findings: UxCopyFinding[] = [];
  const textLower = auditedText.toLowerCase();

  for (const term of snapshot.guideline.glossary) {
    if (!term.forbidden?.length) continue;

    for (const forbidden of term.forbidden) {
      const match = term.caseSensitive
        ? auditedText.includes(forbidden)
        : textLower.includes(forbidden.toLowerCase());

      if (!match) continue;

      const quote = term.caseSensitive
        ? forbidden
        : (() => {
            const idx = textLower.indexOf(forbidden.toLowerCase());
            return auditedText.slice(idx, idx + forbidden.length);
          })();

      findings.push({
        id: `fnd-${randomUUID()}`,
        sessionId,
        sourceId,
        sourceType,
        location: { sourceId },
        issueType: "terminology",
        severity: "major",
        confidence: 1,
        rationale: `Forbidden term "${quote}" — prefer "${term.term}"${term.reason ? `: ${term.reason}` : ""}.`,
        currentText: auditedText,
        status: "proposed",
        termId: term.id,
        evidence: { quote, surface, sourceNodeId: sourceId },
        source: "glossary"
      });
      break;
    }
  }

  return findings;
}
