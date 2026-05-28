import type { ReviewSession } from "@writer/contracts";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { GlassCard } from "@/components/writer/glass-card";
import { formatProductDisplayName } from "@/lib/writer-product-display";

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
