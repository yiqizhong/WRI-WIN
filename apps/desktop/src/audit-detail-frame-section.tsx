import { useMemo, useState } from "react";

import type { ReviewChange, ReviewSession } from "@writer/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { AuditDetailRuleModal } from "./audit-detail-rule-modal";
import type { DaemonClient } from "./daemon-client";

type AuditDetailFrameSectionProps = {
  client: DaemonClient;
  session: ReviewSession;
  frameId: string;
  frameLabel: string;
  changes: ReviewChange[];
  onEditsChange: (edits: Record<string, string>) => void;
};

export function AuditDetailFrameSection({
  client,
  session,
  frameId,
  frameLabel,
  changes,
  onEditsChange
}: AuditDetailFrameSectionProps) {
  const [edits, setEdits] = useState<Record<string, string>>(() =>
    Object.fromEntries(changes.map((change) => [change.id, change.after]))
  );
  const [ruleContent, setRuleContent] = useState<string | null>(null);

  const screenshotUrl = useMemo(
    () => client.sessionScreenshotUrl(session.id, frameId),
    [client, session.id, frameId]
  );

  function updateEdit(changeId: string, value: string) {
    const next = { ...edits, [changeId]: value };
    setEdits(next);
    onEditsChange(next);
  }

  return (
    <section className="flex flex-col gap-4 rounded-md border border-white/10 p-4">
      <h2 className="writer-home-text text-base text-[#e5f1ff]">{frameLabel}</h2>
      <img
        src={screenshotUrl}
        alt={`Screenshot for ${frameLabel}`}
        className="max-h-72 w-full rounded-md border border-white/10 object-contain bg-black/20"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />

      <div className="overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[#e5f1ff]/70">
            <tr>
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Original</th>
              <th className="px-2 py-2">AI suggestion</th>
              <th className="px-2 py-2">Rule</th>
              <th className="px-2 py-2">Your edit</th>
            </tr>
          </thead>
          <tbody>
            {changes.length === 0 ? (
              <tr>
                <td className="px-2 py-4 text-[#e5f1ff]/60" colSpan={5}>
                  No text rows for this frame yet.
                </td>
              </tr>
            ) : null}
            {changes.map((change, index) => (
              <tr key={change.id} className="border-t border-white/10">
                <td className="px-2 py-2">{index + 1}</td>
                <td className="px-2 py-2">{change.before}</td>
                <td className="px-2 py-2">{change.after}</td>
                <td className="px-2 py-2">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => setRuleContent(change.rationale ?? "No rule rationale captured for this finding.")}
                  >
                    View rule
                  </Button>
                </td>
                <td className="px-2 py-2">
                  <Input value={edits[change.id] ?? change.after} onChange={(event) => updateEdit(change.id, event.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AuditDetailRuleModal
        open={Boolean(ruleContent)}
        onOpenChange={(open) => {
          if (!open) {
            setRuleContent(null);
          }
        }}
        layerLabel="Writing rule"
        content={ruleContent ?? ""}
      />
    </section>
  );
}
