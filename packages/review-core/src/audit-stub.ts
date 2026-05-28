import { randomUUID } from "node:crypto";

import type {
  GuidelineSource,
  RewriteCandidate,
  Term,
  ThreeLayerGuidelineSnapshot,
  UxCopyFinding
} from "@writer/contracts";

import { isUsableSurfaceCopy, toSurfaceCopy } from "./figma-text-sanitize";
import { classifySeverity, formatRationale } from "./severity";

export type AuditStubInput = {
  sessionId: string;
  sourceType: "figma" | "pasted_text" | "spreadsheet";
  items: Array<{ sourceId: string; text: string }>;
  /** Optional guideline snapshot — when provided, findings are annotated with citations. */
  guidelineSnapshot?: ThreeLayerGuidelineSnapshot;
};

export type AuditStubResult = {
  findings: UxCopyFinding[];
  rewrites: RewriteCandidate[];
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace every occurrence of a forbidden literal with the preferred term.
 * `matched` is author-supplied glossary content and may contain regex
 * metacharacters (e.g. "C++", ".NET"), so it is escaped before use. The
 * replacement is applied via a function to avoid `$&`/`$1` interpretation, and
 * case sensitivity mirrors the term's own `caseSensitive` flag.
 */
function replaceForbiddenLiteral(
  surface: string,
  matched: string,
  replacement: string,
  caseSensitive: boolean
): string {
  const flags = caseSensitive ? "g" : "gi";
  return surface.replace(new RegExp(escapeRegExp(matched), flags), () => replacement);
}

function matchForbiddenTerms(surface: string, terms: Term[]): Array<{ term: Term; matched: string }> {
  const surfaceLower = surface.toLowerCase();
  const matches: Array<{ term: Term; matched: string }> = [];

  for (const term of terms) {
    if (term.status === "deprecated") continue;
    const candidates = term.forbidden?.length ? term.forbidden : [];
    const hit = candidates.find((f) =>
      term.caseSensitive ? surface.includes(f) : surfaceLower.includes(f.toLowerCase())
    );
    if (hit) {
      matches.push({ term, matched: hit });
    }
  }

  return matches;
}

export function runStubAudit(input: AuditStubInput): AuditStubResult {
  const findings: UxCopyFinding[] = [];
  const rewrites: RewriteCandidate[] = [];

  const snapshot = input.guidelineSnapshot ?? null;

  for (const item of input.items) {
    const surface = toSurfaceCopy(item.text);

    if (!isUsableSurfaceCopy(surface)) {
      continue;
    }

    // Glossary-based findings — only when a guideline snapshot is present
    if (snapshot) {
      const productTerms = snapshot.productPackage?.glossary ?? [];
      const termMatches = matchForbiddenTerms(surface, productTerms);

      for (const { term, matched } of termMatches) {
        const confidence = 0.92;
        const issueType = "terminology" as const;
        const findingId = `fnd-${randomUUID()}`;
        const after = toSurfaceCopy(
          replaceForbiddenLiteral(surface, matched, term.term, term.caseSensitive)
        );
        const excerpt = `Prefer "${term.term}"; avoid "${matched}"${term.reason ? ` — ${term.reason}` : ""}`;
        const guidelineSource: GuidelineSource = {
          layer: "product",
          termId: term.id,
          excerpt
        };

        findings.push({
          id: findingId,
          sessionId: input.sessionId,
          sourceId: item.sourceId,
          sourceType: input.sourceType,
          location: { sourceId: item.sourceId },
          issueType,
          severity: classifySeverity({ issueType, confidence, textLength: surface.length }),
          confidence,
          rationale: `${formatRationale(issueType, `Use "${term.term}" instead of "${matched}".`)} (${excerpt})`,
          currentText: surface,
          termId: term.id,
          source: "glossary",
          status: "proposed"
        });

        if (after !== surface) {
          rewrites.push({
            id: `rw-${randomUUID()}`,
            sessionId: input.sessionId,
            findingId,
            sourceId: item.sourceId,
            before: surface,
            after,
            rationale: excerpt,
            guidelineSource,
            status: "proposed"
          });
        }
      }

    }
  }

  return { findings, rewrites };
}
