import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import type { ReviewChange, ReviewSession } from "@writer/contracts";
import { parseFigmaReviewScope } from "@writer/contracts";

import { AuditDetailFrameSection } from "../audit-detail-frame-section";
import { AuditWritebackButton } from "../audit-writeback-button";
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/audits")}
          className="writer-home-text inline-flex items-center gap-2 text-sm text-[#e5f1ff]/75"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </button>
        <h1 className="writer-home-text text-lg text-[#e5f1ff]">{session.featureName}</h1>
      </div>

      <div className="writer-home-text text-sm text-[#e5f1ff]/80">
        <p>Product: {session.productId ?? "—"}</p>
        <p>{session.description}</p>
        <p>Auditing against: {activeLayerLabel(session)}</p>
        <p>
          Extracted text layers: {nodeCount}
          {changes.length > 0 ? ` · Review rows: ${changes.length}` : ""}
        </p>
      </div>

      {diagnosticMessage ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Figma extraction issue: {diagnosticMessage}
        </p>
      ) : null}

      {nodeCount === 0 && !diagnosticMessage ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          No text layers were extracted from this frame. Confirm the Figma MCP connection, frame URL, and that
          the frame contains TEXT layers.
        </p>
      ) : null}

      {changes.length === 0 && nodeCount > 0 ? (
        <p className="text-sm text-[#e5f1ff]/70">
          Text was extracted but no review rows were created. Try re-running the audit.
        </p>
      ) : null}

      {frameIds.length === 0 ? (
        <p className="text-sm text-[#e5f1ff]/70">No frame scope found on this session.</p>
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
  );
}
