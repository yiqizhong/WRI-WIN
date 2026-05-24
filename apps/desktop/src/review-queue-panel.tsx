import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Dropdown,
  Stack,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
  TextArea,
  Tile
} from "@carbon/react";

import type { ChangeStatus, ReviewChange } from "@writer/contracts";

import type { DaemonClient } from "./daemon-client";
import { WriterSectionHeader } from "./layout/writer-headings";
import { stackFill, surfaceBody, surfaceFillHeight } from "./layout/writer-sizing";

type ReviewQueuePanelProps = {
  client: DaemonClient;
  sessionId: string | null;
  queue: { changes: ReviewChange[] } | null;
  statusFilter: ChangeStatus | "all";
  onStatusFilterChange: (value: ChangeStatus | "all") => void;
  onQueueUpdated: () => void;
  onMessage: (message: string) => void;
};

const STATUS_ITEMS: Array<{ id: ChangeStatus | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "proposed", label: "Proposed" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "skipped", label: "Skipped" },
  { id: "edited", label: "Edited" }
];

function statusTagType(status: ChangeStatus): "blue" | "green" | "red" | "gray" | "purple" {
  if (status === "approved") {
    return "green";
  }
  if (status === "rejected") {
    return "red";
  }
  if (status === "skipped") {
    return "gray";
  }
  if (status === "edited") {
    return "purple";
  }
  return "blue";
}

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

  const selectedStatus = useMemo(
    () => STATUS_ITEMS.find((item) => item.id === statusFilter) ?? STATUS_ITEMS[1],
    [statusFilter]
  );

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
    <Tile className={surfaceFillHeight}>
      <Stack gap={5} className={stackFill}>
        <WriterSectionHeader
          title="Review queue"
          actions={
            <div className="writer-queue-filter">
              <Dropdown
                id="status-filter"
                titleText="Status"
                label={selectedStatus.label}
                items={STATUS_ITEMS}
                itemToString={(item) => item?.label ?? ""}
                selectedItem={selectedStatus}
                onChange={({ selectedItem }) => {
                  if (selectedItem) {
                    onStatusFilterChange(selectedItem.id);
                  }
                }}
                size="md"
              />
              <Button
                kind="secondary"
                size="md"
                disabled={!sessionId || changes.length === 0}
                onClick={() => void bulkApprove()}
              >
                Approve filtered
              </Button>
            </div>
          }
        />

        {!sessionId ? (
          <p className="writer-type-body-compact writer-text-secondary">
            Create a session in <Link to="/figma">Sources</Link>.
          </p>
        ) : changes.length === 0 ? (
          <p className="writer-type-body-compact writer-text-secondary">No items.</p>
        ) : (
          <div className={surfaceBody}>
          <StructuredListWrapper>
            <StructuredListHead>
              <StructuredListRow head>
                <StructuredListCell head>Change</StructuredListCell>
                <StructuredListCell head>Status</StructuredListCell>
                <StructuredListCell head>Actions</StructuredListCell>
              </StructuredListRow>
            </StructuredListHead>
            <StructuredListBody>
              {changes.map((change) => (
                <StructuredListRow key={change.id}>
                  <StructuredListCell>
                    <Stack gap={3}>
                      <p className="writer-type-helper writer-type-mono">{change.sourceId}</p>
                      <p className="writer-type-body-compact">
                        <span className="writer-type-eyebrow">Before</span> {change.before}
                      </p>
                      <p className="writer-type-body-compact">
                        <span className="writer-type-eyebrow">After</span> {change.after}
                      </p>
                      {change.rationale ? (
                        <p className="writer-type-body-compact writer-text-secondary">
                          {change.rationale}
                        </p>
                      ) : null}
                      {editingId === change.id ? (
                        <TextArea
                          id={`edit-${change.id}`}
                          labelText="Edited copy"
                          rows={2}
                          value={draftAfter}
                          onChange={(event) => setDraftAfter(event.target.value)}
                        />
                      ) : null}
                    </Stack>
                  </StructuredListCell>
                  <StructuredListCell>
                    <Tag type={statusTagType(change.status)}>{change.status}</Tag>
                  </StructuredListCell>
                  <StructuredListCell>
                    <div className="writer-row-actions">
                      <Button kind="secondary" size="sm" onClick={() => void act(change.id, "approved")}>
                        Approve
                      </Button>
                      <Button
                        kind="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingId(change.id);
                          setDraftAfter(change.after);
                        }}
                      >
                        Edit
                      </Button>
                      {editingId === change.id ? (
                        <Button kind="primary" size="sm" onClick={() => void saveEdit(change)}>
                          Save edit
                        </Button>
                      ) : null}
                      <Button kind="ghost" size="sm" onClick={() => void act(change.id, "rejected")}>
                        Reject
                      </Button>
                      <Button kind="ghost" size="sm" onClick={() => void act(change.id, "skipped")}>
                        Skip
                      </Button>
                    </div>
                  </StructuredListCell>
                </StructuredListRow>
              ))}
            </StructuredListBody>
          </StructuredListWrapper>
          </div>
        )}
      </Stack>
    </Tile>
  );
}
