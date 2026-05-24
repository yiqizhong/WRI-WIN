import { randomUUID } from "node:crypto";

import type { RewriteCandidate, UxCopyFinding } from "@writer/contracts";

import { isUsableSurfaceCopy, toSurfaceCopy } from "./figma-text-sanitize";
import { classifySeverity, formatRationale } from "./severity";

export type AuditStubInput = {
  sessionId: string;
  sourceType: "figma" | "pasted_text" | "spreadsheet";
  items: Array<{ sourceId: string; text: string }>;
};

export type AuditStubResult = {
  findings: UxCopyFinding[];
  rewrites: RewriteCandidate[];
};

export function runStubAudit(input: AuditStubInput): AuditStubResult {
  const findings: UxCopyFinding[] = [];
  const rewrites: RewriteCandidate[] = [];

  for (const item of input.items) {
    const surface = toSurfaceCopy(item.text);

    if (!isUsableSurfaceCopy(surface)) {
      continue;
    }

    if (surface.length < 4) {
      const confidence = 0.62;
      const issueType = "clarity" as const;
      const findingId = `fnd-${randomUUID()}`;

      findings.push({
        id: findingId,
        sessionId: input.sessionId,
        sourceId: item.sourceId,
        sourceType: input.sourceType,
        location: { sourceId: item.sourceId },
        issueType,
        severity: classifySeverity({ issueType, confidence, textLength: surface.length }),
        confidence,
        rationale: formatRationale(issueType, "Text is very short for a user-facing label."),
        currentText: surface,
        status: "proposed"
      });
    }

    if (/click here|learn more/i.test(surface)) {
      const confidence = 0.88;
      const issueType = "actionability" as const;
      const findingId = `fnd-${randomUUID()}`;
      const after = toSurfaceCopy(
        surface.replace(/click here/gi, "View details").replace(/learn more/gi, "See how it works")
      );

      findings.push({
        id: findingId,
        sessionId: input.sessionId,
        sourceId: item.sourceId,
        sourceType: input.sourceType,
        location: { sourceId: item.sourceId },
        issueType,
        severity: classifySeverity({ issueType, confidence, textLength: surface.length }),
        confidence,
        rationale: formatRationale(issueType, "Generic link labels hide the destination."),
        currentText: surface,
        status: "proposed"
      });

      rewrites.push({
        id: `rw-${randomUUID()}`,
        sessionId: input.sessionId,
        findingId,
        sourceId: item.sourceId,
        before: surface,
        after,
        rationale: "Use a specific, action-oriented label.",
        status: "proposed"
      });
    }
  }

  return { findings, rewrites };
}
