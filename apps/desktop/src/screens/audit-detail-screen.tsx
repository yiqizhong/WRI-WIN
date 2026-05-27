import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import type { ReviewChange, ReviewSession } from "@writer/contracts";
import { parseFigmaReviewScope } from "@writer/contracts";
import { InlineAlert } from "@/components/writer/inline-alert";
import { WriterPageSubheader } from "@/components/writer/writer-page-subheader";
import { formatProductDisplayName } from "@/lib/writer-product-display";

import { AuditDetailFrameSection } from "../audit-detail-frame-section";
import { AuditWritebackButton } from "../audit-writeback-button";
import { WorkflowGlassPanel, WorkflowScreenShell } from "../layout/workflow-screen-shell";
import { useWorkspace } from "../workspace-context";

function frameIdsForSession(session: ReviewSession): string[] {
  const scope = session.scope as Record<string, unknown>;
  const figmaScope = scope.suggestedScope
    ? parseFigmaReviewScope(scope.suggestedScope)
    : parseFigmaReviewScope(scope);

  if (figmaScope.kind === "frame") {
    return [figmaScope.nodeId];
  }

  if (figmaScope.kind === "flow") {
    return figmaScope.nodeIds;
  }

  return [];
}

function extractionSummary(session: ReviewSession): {
  nodeCount: number;
  diagnosticMessage: string | null;
} {
  const scope = session.scope as Record<string, unknown>;
  const extraction = scope.extraction as { nodes?: Array<{ id: string }> } | undefined;
  const diagnostic = scope.extractionDiagnostic as { message?: string } | undefined;

  return {
    nodeCount: extraction?.nodes?.length ?? 0,
    diagnosticMessage: diagnostic?.message ?? session.diagnostic?.message ?? null
  };
}

function activeLayerLabel(session: ReviewSession): string {
  const snapshot = session.guidelineSnapshot;

  if (snapshot && "activeProductId" in snapshot && snapshot.activeProductId) {
    return "Company Base + Software Writing + Product";
  }

  return "Company Base + Software Writing";
}

export function AuditDetailScreen() {
  const { sessionId = "" } = useParams();
  const navigate = useNavigate();
  const { daemonClient } = useWorkspace();
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [changes, setChanges] = useState<ReviewChange[]>([]);
  const [editsByChange, setEditsByChange] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    void daemonClient.getSession(sessionId).then(setSession);
    void daemonClient.getReviewQueue(sessionId).then((queue) => setChanges(queue.changes));
  }, [daemonClient, sessionId]);

  const frameIds = useMemo(() => (session ? frameIdsForSession(session) : []), [session]);

  const rows = changes.map((change) => ({
    changeId: change.id,
    finalText: editsByChange[change.id] ?? change.after
  }));

  if (!session) {
    return null;
  }

  const { nodeCount, diagnosticMessage } = extractionSummary(session);

  const pageTitle = session.featureName?.trim() || "Audit";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <WriterPageSubheader title={pageTitle} backTo="/audits" backLabel="Back to Audits Log" />

      <div className="writer-page-content-inset flex min-h-0 flex-1 flex-col">
        <WorkflowScreenShell className="writer-page-subheader-content-gap min-h-0 flex-1">
          {session.description ? (
            <p className="writer-type-body-compact m-0 max-w-2xl text-[#e5f1ff]/70">{session.description}</p>
          ) : null}

          <WorkflowGlassPanel title="Session details">
            <dl className="writer-home-text grid gap-2 text-sm text-[#e5f1ff]/80">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-[#e5f1ff]/60">Product</dt>
                <dd>{session.productId ? formatProductDisplayName(session.productId) : "—"}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-[#e5f1ff]/60">Guidelines</dt>
                <dd>{activeLayerLabel(session)}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-[#e5f1ff]/60">Extraction</dt>
                <dd>
                  {nodeCount} text layer{nodeCount === 1 ? "" : "s"}
                  {changes.length > 0
                    ? ` · ${changes.length} review row${changes.length === 1 ? "" : "s"}`
                    : ""}
                </dd>
              </div>
            </dl>
          </WorkflowGlassPanel>

          {diagnosticMessage ? (
            <InlineAlert kind="warning" title="Figma extraction issue" subtitle={diagnosticMessage} />
          ) : null}

          {nodeCount === 0 && !diagnosticMessage ? (
            <InlineAlert
              kind="warning"
              title="No text extracted"
              subtitle="Confirm the Figma MCP connection, frame URL, and that the frame contains TEXT layers."
            />
          ) : null}

          {changes.length === 0 && nodeCount > 0 ? (
            <InlineAlert
              kind="info"
              title="No review rows"
              subtitle="Text was extracted but no review rows were created. Try re-running the audit."
            />
          ) : null}

          {frameIds.length === 0 ? (
            <InlineAlert kind="info" title="No frames" subtitle="No frame scope found on this session." />
          ) : null}

          {frameIds.map((frameId, index) => (
            <AuditDetailFrameSection
              key={frameId}
              client={daemonClient}
              session={session}
              frameId={frameId}
              frameLabel={`Frame ${index + 1}`}
              changes={changes}
              onEditsChange={(edits) => setEditsByChange((current) => ({ ...current, ...edits }))}
            />
          ))}

          <WorkflowGlassPanel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="writer-home-text text-sm text-[#e5f1ff]/70">
                Approve edits and push changes back to Figma when ready.
              </p>
              <AuditWritebackButton
                client={daemonClient}
                session={session}
                rows={rows}
                changes={changes}
                onComplete={() => {
                  void daemonClient.getSession(sessionId).then(setSession);
                  navigate("/audits");
                }}
              />
            </div>
          </WorkflowGlassPanel>
        </WorkflowScreenShell>
      </div>
    </div>
  );
}
