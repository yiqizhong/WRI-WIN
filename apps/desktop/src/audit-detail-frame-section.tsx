import { useMemo, useState } from "react";

import type { ReviewChange, ReviewSession } from "@writer/contracts";
import { AuditDetailEditModal } from "./audit-detail-edit-modal";
import { AuditDetailRuleModal } from "./audit-detail-rule-modal";
import type { DaemonClient } from "./daemon-client";
import { WorkflowGlassPanel } from "./layout/workflow-screen-shell";

type AuditDetailFrameSectionProps = {
  client: DaemonClient;
  session: ReviewSession;
  frameId: string;
  frameLabel: string;
  changes: ReviewChange[];
  onEditsChange: (edits: Record<string, string>) => void;
};

type RuleModalState = {
  original: string;
  aiSuggestion: string;
  rationale?: string;
};

type EditModalState = {
  changeId: string;
  original: string;
  aiSuggestion: string;
  value: string;
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
  const [ruleModal, setRuleModal] = useState<RuleModalState | null>(null);
  const [editModal, setEditModal] = useState<EditModalState | null>(null);

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
            const currentEdit = edits[change.id] ?? change.after;

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
                <td className="writer-audit-findings-table__actions">
                  <button
                    type="button"
                    className="writer-text-action-link"
                    onClick={() =>
                      setEditModal({
                        changeId: change.id,
                        original: change.before,
                        aiSuggestion: change.after,
                        value: currentEdit
                      })
                    }
                  >
                    Edit
                  </button>
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

      <AuditDetailEditModal
        open={Boolean(editModal)}
        onOpenChange={(open) => {
          if (!open) {
            setEditModal(null);
          }
        }}
        original={editModal?.original ?? ""}
        aiSuggestion={editModal?.aiSuggestion ?? ""}
        value={editModal?.value ?? ""}
        onSave={(value) => {
          if (editModal) {
            updateEdit(editModal.changeId, value);
          }
        }}
      />
    </WorkflowGlassPanel>
  );
}
