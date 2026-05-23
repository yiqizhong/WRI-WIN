import { useState } from "react";

import type { ChangeStatus, ReviewChange } from "@writer/contracts";

import type { DaemonClient } from "./daemon-client";

type ReviewQueuePanelProps = {
  client: DaemonClient;
  sessionId: string | null;
  queue: { changes: ReviewChange[] } | null;
  statusFilter: ChangeStatus | "all";
  onStatusFilterChange: (value: ChangeStatus | "all") => void;
  onQueueUpdated: () => void;
  onMessage: (message: string) => void;
};

export function ReviewQueuePanel({
  client,
  sessionId,
  queue,
  statusFilter,
  onStatusFilterChange,
  onQueueUpdated,
  onMessage
}: ReviewQueuePanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftAfter, setDraftAfter] = useState("");

  const changes = (queue?.changes ?? []).filter(
    (change) => statusFilter === "all" || change.status === statusFilter
  );

  async function act(changeId: string, nextStatus: ChangeStatus, after?: string) {
    if (!sessionId) {
      return;
    }

    try {
      await client.transitionChange({ changeId, nextStatus, after });
      setEditingId(null);
      onQueueUpdated();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not update change.");
    }
  }

  async function saveEdit(change: ReviewChange) {
    const trimmed = draftAfter.trim();
    if (!trimmed) {
      onMessage("Edited copy cannot be empty.");
      return;
    }

    await act(change.id, "edited", trimmed);
    onMessage(`Saved edit for ${change.sourceId}.`);
  }

  async function bulkApprove() {
    if (!sessionId || changes.length === 0) {
      return;
    }

    try {
      await client.bulkTransition({
        changeIds: changes.map((change) => change.id),
        nextStatus: "approved"
      });
      onMessage(`Approved ${changes.length} filtered items.`);
      onQueueUpdated();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Bulk approve failed.");
    }
  }

  return (
    <section className="panel review-queue-panel">
      <div className="review-queue-header">
        <div>
          <p className="eyebrow">Human gate</p>
          <h2>Review queue</h2>
        </div>
        <div className="review-queue-actions">
          <label className="filter-label">
            Status
            <select
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value as ChangeStatus | "all")}
            >
              <option value="all">All</option>
              <option value="proposed">Proposed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="skipped">Skipped</option>
            </select>
          </label>
          <button className="secondary-action" disabled={!sessionId || changes.length === 0} onClick={() => void bulkApprove()}>
            Approve filtered
          </button>
        </div>
      </div>

      {!sessionId ? (
        <p className="queue-empty">Create a review session to populate the queue.</p>
      ) : changes.length === 0 ? (
        <p className="queue-empty">No items match this filter. Run an audit to generate proposals.</p>
      ) : (
        <ul className="queue-list">
          {changes.map((change) => (
            <li className="queue-item" key={change.id}>
              <div className="queue-item-meta">
                <strong>{change.sourceId}</strong>
                <span className={`status-pill status-${change.status}`}>{change.status}</span>
              </div>
              <p>
                <span className="copy-label">Before</span> {change.before}
              </p>
              <p>
                <span className="copy-label">After</span> {change.after}
              </p>
              {change.rationale ? <p className="queue-rationale">{change.rationale}</p> : null}
              {editingId === change.id ? (
                <label className="edit-copy-field">
                  Edited copy
                  <textarea rows={2} value={draftAfter} onChange={(event) => setDraftAfter(event.target.value)} />
                </label>
              ) : null}
              <div className="queue-item-actions">
                <button className="secondary-action" onClick={() => void act(change.id, "approved")}>
                  Approve
                </button>
                <button
                  className="secondary-action"
                  onClick={() => {
                    setEditingId(change.id);
                    setDraftAfter(change.after);
                  }}
                >
                  Edit
                </button>
                {editingId === change.id ? (
                  <button className="secondary-action" onClick={() => void saveEdit(change)}>
                    Save edit
                  </button>
                ) : null}
                <button className="secondary-action" onClick={() => void act(change.id, "rejected")}>
                  Reject
                </button>
                <button className="secondary-action" onClick={() => void act(change.id, "skipped")}>
                  Skip
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
