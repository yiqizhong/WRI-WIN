import { useMemo, useState } from "react";

import type { ReviewChange, ReviewSession } from "@writer/contracts";
import { Textarea } from "@/components/ui/textarea";
import { AuditDetailRuleModal } from "./audit-detail-rule-modal";
import type { DaemonClient } from "./daemon-client";
import { WorkflowGlassPanel } from "./layout/workflow-screen-shell";

type AuditDetailFrameSectionProps = {
  client: DaemonClient;
  session: ReviewSession;
  frameId: string;
  frameLabel: string;
  changes: ReviewChange[];
  editsLocked?: boolean;
  onEditsChange: (edits: Record<string, string>) => void;
};

type RuleModalState = {
  original: string;
  aiSuggestion: string;
  rationale?: string;
};

function userOverrideText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function AuditDetailFrameSection({
  client,
  session,
  frameId,
  frameLabel,
  changes,
  editsLocked = false,
  onEditsChange
}: AuditDetailFrameSectionProps) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [ruleModal, setRuleModal] = useState<RuleModalState | null>(null);

  const screenshotUrl = useMemo(
    () => client.sessionScreenshotUrl(session.id, frameId),
    [client, session.id, frameId]
  );

  function updateEdit(changeId: string, value: string) {
    const next = { ...edits };

    if (userOverrideText(value)) {
      next[changeId] = value;
    } else {
      delete next[changeId];
    }

    setEdits(next);
    onEditsChange(next);
  }

  return (
    <WorkflowGlassPanel
      title={frameLabel}
      description="Screenshot and copy suggestions for this frame."
    >
      <img
        src={screenshotUrl}
        alt={`Screenshot for ${frameLabel}`}
        className="max-h-72 w-full rounded-md border border-white/10 object-contain bg-black/20"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />

      <table className="writer-audit-findings-table writer-home-text">
        <thead>
          <tr>
            <th className="writer-audit-findings-table__head writer-audit-findings-table__head--index">
              #
            </th>
            <th className="writer-audit-findings-table__head">Original</th>
            <th className="writer-audit-findings-table__head">AI suggestion</th>
            <th className="writer-audit-findings-table__head">Rule</th>
            <th className="writer-audit-findings-table__head">Your edit</th>
          </tr>
        </thead>
        <tbody>
          {changes.length === 0 ? (
            <tr>
              <td className="writer-audit-findings-table__empty" colSpan={5}>
                No text rows for this frame yet.
              </td>
            </tr>
          ) : null}
          {changes.map((change, index) => {
            const userEdit = edits[change.id] ?? "";

            return (
              <tr key={change.id} className="writer-audit-findings-table__row">
                <td className="writer-audit-findings-table__index">{index + 1}</td>
                <td className="writer-audit-findings-table__cell">{change.before}</td>
                <td className="writer-audit-findings-table__cell">{change.after}</td>
                <td className="writer-audit-findings-table__actions">
                  <button
                    type="button"
                    className="writer-text-action-link"
                    onClick={() =>
                      setRuleModal({
                        original: change.before,
                        aiSuggestion: change.after,
                        rationale: change.rationale
                      })
                    }
                  >
                    View rule
                  </button>
                </td>
                <td
                  className={
                    editsLocked
                      ? "writer-audit-findings-table__cell"
                      : "writer-audit-findings-table__edit-cell"
                  }
                >
                  {editsLocked ? (
                    userOverrideText(userEdit) ?? "—"
                  ) : (
                    <Textarea
                      value={userEdit}
                      onChange={(event) => updateEdit(change.id, event.target.value)}
                      rows={3}
                      placeholder="Optional override"
                      className="writer-audit-findings-table__edit-input rounded-[2px] text-sm"
                      aria-label={`Your edit for row ${index + 1}`}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <AuditDetailRuleModal
        open={Boolean(ruleModal)}
        onOpenChange={(open) => {
          if (!open) {
            setRuleModal(null);
          }
        }}
        layerLabel="Writing rule"
        original={ruleModal?.original ?? ""}
        aiSuggestion={ruleModal?.aiSuggestion ?? ""}
        rationale={ruleModal?.rationale}
      />

    </WorkflowGlassPanel>
  );
}
