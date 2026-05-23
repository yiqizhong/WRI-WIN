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
    <Tile>
      <Stack gap={5}>
        <Stack gap={5} orientation="horizontal" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Review queue</h2>
          <Stack gap={3} orientation="horizontal" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
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
            <Button kind="secondary" size="md" disabled={!sessionId || changes.length === 0} onClick={() => void bulkApprove()}>
              Approve filtered
            </Button>
          </Stack>
        </Stack>

        {!sessionId ? (
          <p style={{ margin: 0, color: "var(--cds-text-secondary)" }}>
            Create a review session from <Link to="/figma">Sources</Link> to populate the queue.
          </p>
        ) : changes.length === 0 ? (
          <p style={{ margin: 0, color: "var(--cds-text-secondary)" }}>
            No items match this filter. Run an audit to generate proposals.
          </p>
        ) : (
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
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--cds-text-secondary)" }}>
                        {change.sourceId}
                      </p>
                      <p style={{ margin: 0 }}>
                        <strong>Before</strong> {change.before}
                      </p>
                      <p style={{ margin: 0 }}>
                        <strong>After</strong> {change.after}
                      </p>
                      {change.rationale ? (
                        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--cds-text-secondary)" }}>
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
                    <Stack gap={3} orientation="horizontal" style={{ flexWrap: "wrap" }}>
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
                    </Stack>
                  </StructuredListCell>
                </StructuredListRow>
              ))}
            </StructuredListBody>
          </StructuredListWrapper>
        )}
      </Stack>
    </Tile>
  );
}
