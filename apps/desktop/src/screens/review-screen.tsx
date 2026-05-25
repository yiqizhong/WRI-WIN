/** @deprecated Use `/audits` for the session list and `/audits/:sessionId` for per-frame detail. */
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

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
    <WriterPageGrid gutterMode="condensed" equalRowHeight className="h-full">
      <WriterPageGridFull>
        <WriterPageStack>
          {workspace.selectedProductName || workspace.activeSessionId ? (
            <div className="writer-session-strip">
              {workspace.selectedProductName ? (
                <span>
                  Product:{" "}
                  <strong className="writer-type-body-compact">{workspace.selectedProductName}</strong>
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
                  {counts.proposed > 0 ? (
                    <Badge variant="secondary">{counts.proposed} proposed</Badge>
                  ) : null}
                  {counts.approved > 0 ? <Badge>{counts.approved} approved</Badge> : null}
                  {counts.rejected > 0 ? (
                    <Badge variant="destructive">{counts.rejected} rejected</Badge>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <WorkflowNotification />

          {!hasSession ? (
            <p className="writer-type-body writer-text-secondary">
              No active audit. Paste a Figma link and run an audit from{" "}
              <Link to="/figma">Sources</Link>.
            </p>
          ) : null}

          <div className="writer-review-toolbar">
            <Button variant="secondary" disabled={!hasSession} onClick={() => void workspace.runAudit()}>
              Run audit again
            </Button>
            {workspace.workflowRecovery ? (
              <Button variant="ghost" render={<Link to={workspace.workflowRecovery.path} />}>
                {workspace.workflowRecovery.label}
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" disabled={!hasSession}>
                    Export
                    <ChevronDown className="size-4 opacity-60" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void workspace.exportSession("markdown")}>
                  Markdown
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void workspace.exportSession("json")}>
                  JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void workspace.exportSession("pdf")}>
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
