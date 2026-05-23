import { Link } from "react-router-dom";
import { Button, Stack, Tag } from "@carbon/react";

import { ChangelogPanel } from "../changelog-panel";
import {
  WriterPageGrid,
  WriterPageGridFull,
  WriterPageGridHalf,
  WriterPageStack
} from "../layout/writer-grid";
import { ReviewQueuePanel } from "../review-queue-panel";
import { useWorkspace } from "../workspace-context";
import { WorkflowNotification } from "../workflow-notification";

function statusCounts(changes: Array<{ status: string }> | undefined) {
  const counts = { proposed: 0, approved: 0, rejected: 0, skipped: 0, edited: 0 };
  for (const change of changes ?? []) {
    if (change.status in counts) {
      counts[change.status as keyof typeof counts] += 1;
    }
  }
  return counts;
}

export function ReviewScreen() {
  const workspace = useWorkspace();
  const counts = statusCounts(workspace.reviewQueue?.changes);

  return (
    <WriterPageGrid gutterMode="condensed" equalRowHeight>
      <WriterPageGridFull>
        <WriterPageStack>
          {workspace.activeProject || workspace.activeSessionId ? (
            <div className="writer-session-strip">
              {workspace.activeProject ? (
                <span>
                  Project: <strong>{workspace.activeProject.name}</strong>
                </span>
              ) : null}
              {workspace.activeSessionId ? (
                <span>
                  Session: <strong>{workspace.activeSessionId.slice(0, 8)}…</strong>
                </span>
              ) : null}
              {workspace.reviewQueue ? (
                <Stack gap={3} orientation="horizontal">
                  {counts.proposed > 0 ? <Tag type="blue">{counts.proposed} proposed</Tag> : null}
                  {counts.approved > 0 ? <Tag type="green">{counts.approved} approved</Tag> : null}
                  {counts.rejected > 0 ? <Tag type="red">{counts.rejected} rejected</Tag> : null}
                </Stack>
              ) : null}
            </div>
          ) : null}

          <WorkflowNotification />

          {!workspace.activeProject ? (
            <p style={{ margin: 0, color: "var(--cds-text-secondary)" }}>
              Open a project to start reviewing copy. Add sources from{" "}
              <Link to="/figma">Sources</Link>.
            </p>
          ) : null}

          <div className="writer-toolbar-band">
            <Stack gap={3} orientation="horizontal" className="writer-fill-w writer-hug-h">
              <Button kind="secondary" size="md" disabled={!workspace.activeSessionId} onClick={() => void workspace.runAudit()}>
                Run audit
              </Button>
              <Button
                kind="secondary"
                size="md"
                disabled={!workspace.activeSessionId}
                onClick={() => void workspace.exportSession("markdown")}
              >
                Export Markdown
              </Button>
              <Button
                kind="secondary"
                size="md"
                disabled={!workspace.activeSessionId}
                onClick={() => void workspace.exportSession("json")}
              >
                Export JSON
              </Button>
              <Button
                kind="secondary"
                size="md"
                disabled={!workspace.activeSessionId}
                onClick={() => void workspace.exportSession("pdf")}
              >
                Export PDF
              </Button>
              <Button
                kind="ghost"
                size="md"
                disabled={!workspace.activeSessionId}
                onClick={() => void workspace.exportSpreadsheet()}
              >
                Export spreadsheet
              </Button>
            </Stack>
          </div>
        </WriterPageStack>
      </WriterPageGridFull>

      <WriterPageGridHalf fillHeight>
        <ReviewQueuePanel
          client={workspace.daemonClient}
          sessionId={workspace.activeSessionId}
          queue={workspace.reviewQueue}
          statusFilter={workspace.statusFilter}
          onStatusFilterChange={workspace.setStatusFilter}
          onQueueUpdated={() => void workspace.refreshQueue()}
          onMessage={workspace.setWorkflowMessage}
        />
      </WriterPageGridHalf>

      <WriterPageGridHalf fillHeight>
        <ChangelogPanel client={workspace.daemonClient} sessionId={workspace.activeSessionId} />
      </WriterPageGridHalf>
    </WriterPageGrid>
  );
}
