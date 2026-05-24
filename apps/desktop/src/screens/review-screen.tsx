import { Link } from "react-router-dom";
import {
  Button,
  OverflowMenu,
  OverflowMenuItem,
  Tag
} from "@carbon/react";

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
  const hasSession = Boolean(workspace.activeSessionId);

  return (
    <WriterPageGrid gutterMode="condensed" equalRowHeight>
      <WriterPageGridFull>
        <WriterPageStack>
          {workspace.activeProject || workspace.activeSessionId ? (
            <div className="writer-session-strip">
              {workspace.activeProject ? (
                <span>
                  Project:{" "}
                  <strong className="writer-type-body-compact">{workspace.activeProject.name}</strong>
                </span>
              ) : null}
              {workspace.activeSessionId ? (
                <span>
                  Session:{" "}
                  <strong className="writer-type-body-compact writer-type-mono">
                    {workspace.activeSessionId.slice(0, 8)}…
                  </strong>
                </span>
              ) : null}
              {workspace.reviewQueue ? (
                <div className="writer-tag-row">
                  {counts.proposed > 0 ? <Tag type="blue">{counts.proposed} proposed</Tag> : null}
                  {counts.approved > 0 ? <Tag type="green">{counts.approved} approved</Tag> : null}
                  {counts.rejected > 0 ? <Tag type="red">{counts.rejected} rejected</Tag> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <WorkflowNotification />

          {!workspace.activeProject ? (
            <p className="writer-type-body writer-text-secondary">
              No project open. Add sources in <Link to="/figma">Sources</Link>.
            </p>
          ) : null}

          <div className="writer-review-toolbar">
            <Button kind="tertiary" size="md" disabled={!hasSession} onClick={() => void workspace.runAudit()}>
              Run audit
            </Button>
            <OverflowMenu
              aria-label="Export"
              size="md"
              flipped
              disabled={!hasSession}
            >
              <OverflowMenuItem
                itemText="Export as Markdown"
                onClick={() => void workspace.exportSession("markdown")}
              />
              <OverflowMenuItem
                itemText="Export as JSON"
                onClick={() => void workspace.exportSession("json")}
              />
              <OverflowMenuItem
                itemText="Export as PDF"
                onClick={() => void workspace.exportSession("pdf")}
              />
              <OverflowMenuItem
                itemText="Export as spreadsheet"
                onClick={() => void workspace.exportSpreadsheet()}
              />
            </OverflowMenu>
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
