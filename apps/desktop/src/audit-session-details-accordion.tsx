import type { ReviewSession } from "@writer/contracts";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { GlassCard } from "@/components/writer/glass-card";
import { formatProductDisplayName } from "@/lib/writer-product-display";

import { resolveAuditSessionFigmaLinks } from "./audit-session-figma-links";

const SESSION_DETAILS_ITEM = "session-details";

type AuditSessionDetailsAccordionProps = {
  session: ReviewSession;
  guidelinesLabel: string;
  nodeCount: number;
  reviewRowCount: number;
};

export function AuditSessionDetailsAccordion({
  session,
  guidelinesLabel,
  nodeCount,
  reviewRowCount
}: AuditSessionDetailsAccordionProps) {
  const figmaLinks = resolveAuditSessionFigmaLinks(session);

  return (
    <GlassCard variant="outline" className="writer-audit-session-accordion p-4">
      <Accordion defaultValue={[]}>
        <AccordionItem value={SESSION_DETAILS_ITEM} className="border-0">
          <AccordionTrigger className="writer-audit-session-accordion__trigger writer-home-text writer-home-section-title tracking-normal">
            Session details
          </AccordionTrigger>
          <AccordionContent className="writer-audit-session-accordion__content">
            <dl className="writer-home-text grid gap-2 text-sm text-[#e5f1ff]/80">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-[#e5f1ff]/60">Product</dt>
                <dd>{session.productId ? formatProductDisplayName(session.productId) : "—"}</dd>
              </div>
              {figmaLinks.length > 0 ? (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-[#e5f1ff]/60">Figma</dt>
                  <dd className="min-w-0">
                    {figmaLinks.length === 1 ? (
                      <a
                        href={figmaLinks[0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="writer-text-action-link break-all"
                        title={figmaLinks[0]}
                      >
                        {figmaLinks[0]}
                      </a>
                    ) : (
                      <ul className="grid gap-1">
                        {figmaLinks.map((link) => (
                          <li key={link}>
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="writer-text-action-link break-all"
                              title={link}
                            >
                              {link}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-[#e5f1ff]/60">Guidelines</dt>
                <dd>{guidelinesLabel}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-[#e5f1ff]/60">Extraction</dt>
                <dd>
                  {nodeCount} text layer{nodeCount === 1 ? "" : "s"}
                  {reviewRowCount > 0
                    ? ` · ${reviewRowCount} review row${reviewRowCount === 1 ? "" : "s"}`
                    : ""}
                </dd>
              </div>
            </dl>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </GlassCard>
  );
}
