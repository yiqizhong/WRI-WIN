import { useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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

function statusBadgeVariant(
  status: ChangeStatus
): "default" | "destructive" | "secondary" | "outline" {
  if (status === "approved") {
    return "default";
  }
  if (status === "rejected") {
    return "destructive";
  }
  if (status === "skipped") {
    return "secondary";
  }
  if (status === "edited") {
    return "outline";
  }
  return "default";
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
  const [pendingWritePermissionId, setPendingWritePermissionId] = useState<string | null>(null);

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

  function getWritebackEligibleChanges() {
    return (queue?.changes ?? []).filter(
      (change) => change.status === "approved" || change.status === "edited"
    );
  }

  async function applyApprovedToFigma(permissionRequestId?: string) {
    if (!sessionId || !queue) {
      return;
    }

    const eligible = getWritebackEligibleChanges();

    if (eligible.length === 0) {
      onMessage("Approve or edit queue items first. Approve only saves locally — use Apply to push to Figma.");
      return;
    }

    try {
      const result = await client.runFigmaWriteback({
        sessionId,
        changeIds: eligible.map((change) => change.id),
        permissionRequestId
      });

      const applied = result.results.filter((item) => item.status === "applied").length;
      const failed = result.results.filter((item) => item.status === "failed").length;
      const skipped = result.results.filter((item) => item.status === "skipped").length;

      if (result.permissionRequestId) {
        setPendingWritePermissionId(result.permissionRequestId);
        onMessage(
          "Writer needs permission to edit Figma. Click “Allow Figma write & apply” to confirm, then text will be written to your file."
        );
        return;
      }

      setPendingWritePermissionId(null);

      if (applied > 0) {
        onMessage(`Figma writeback: ${applied} applied, ${failed} failed, ${skipped} skipped.`);
      } else if (failed > 0) {
        const detail = result.results.find((item) => item.status === "failed")?.message;
        onMessage(detail ? `Figma writeback failed: ${detail}` : `Figma writeback failed (${failed} items).`);
      } else {
        onMessage(`Figma writeback: ${skipped} skipped, nothing written.`);
      }

      onQueueUpdated();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Figma writeback failed.");
    }
  }

  async function allowFigmaWriteAndApply() {
    if (!pendingWritePermissionId) {
      await applyApprovedToFigma();
      return;
    }

    try {
      await client.decidePermission({
        requestId: pendingWritePermissionId,
        decision: "approved"
      });
      await applyApprovedToFigma(pendingWritePermissionId);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not approve Figma write permission.");
    }
  }

  const hasEligibleWriteback = getWritebackEligibleChanges().length > 0;

  return (
    <Card className={surfaceFillHeight}>
      <CardContent className={`flex flex-col gap-5 pt-6 ${stackFill}`}>
        <WriterSectionHeader
          title="Review queue"
          actions={
            <div className="writer-queue-filter">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="status-filter" className="sr-only">
                  Status
                </Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    if (value) {
                      onStatusFilterChange(value as ChangeStatus | "all");
                    }
                  }}
                >
                  <SelectTrigger id="status-filter" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ITEMS.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={!sessionId || changes.length === 0}
                onClick={() => void bulkApprove()}
              >
                Approve filtered
              </Button>
              {pendingWritePermissionId ? (
                <Button
                  size="sm"
                  disabled={!sessionId || !hasEligibleWriteback}
                  onClick={() => void allowFigmaWriteAndApply()}
                >
                  Allow Figma write & apply
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={!sessionId || !hasEligibleWriteback}
                  onClick={() => void applyApprovedToFigma()}
                >
                  Apply approved to Figma
                </Button>
              )}
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
            <div className="flex flex-col gap-4" role="table">
              <div
                className="writer-naked-hairline hidden gap-4 border-b pb-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                role="row"
              >
                <span role="columnheader">Change</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Actions</span>
              </div>
              {changes.map((change) => (
                <div
                  key={change.id}
                  className="writer-naked-hairline flex flex-col gap-4 border-b pb-4 last:border-b-0 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-start"
                  role="row"
                >
                  <div role="cell">
                    <div className="flex flex-col gap-3">
                      <p className="writer-type-body-compact">
                        <span className="writer-type-eyebrow">Before</span> {change.before}
                      </p>
                      <p className="writer-type-body-compact">
                        <span className="writer-type-eyebrow">After</span> {change.after}
                      </p>
                      {change.rationale ? (
                        <p className="writer-type-body-compact writer-text-secondary">{change.rationale}</p>
                      ) : null}
                      {editingId === change.id ? (
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`edit-${change.id}`}>Edited copy</Label>
                          <Textarea
                            id={`edit-${change.id}`}
                            rows={2}
                            value={draftAfter}
                            onChange={(event) => setDraftAfter(event.target.value)}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div role="cell">
                    <Badge variant={statusBadgeVariant(change.status)}>{change.status}</Badge>
                  </div>
                  <div role="cell">
                    <div className="writer-row-actions">
                      <Button variant="secondary" size="sm" onClick={() => void act(change.id, "approved")}>
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingId(change.id);
                          setDraftAfter(change.after);
                        }}
                      >
                        Edit
                      </Button>
                      {editingId === change.id ? (
                        <Button size="sm" onClick={() => void saveEdit(change)}>
                          Save edit
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="sm" onClick={() => void act(change.id, "rejected")}>
                        Reject
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void act(change.id, "skipped")}>
                        Skip
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
