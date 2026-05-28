import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

import type { ReviewChange, ReviewSession } from "@writer/contracts";
import { parseFigmaReviewScope, resolveFigmaFrameDisplayName } from "@writer/contracts";
import { InlineAlert } from "@/components/writer/inline-alert";
import { WriterPageSubheader } from "@/components/writer/writer-page-subheader";
import { formatAuditDetailPageTitle } from "@/lib/writer-product-display";

import { AuditSessionDetailsAccordion } from "../audit-session-details-accordion";
import { deriveAuditRunStatus } from "../audit-run-status";
import { AuditDetailFrameSection } from "../audit-detail-frame-section";
import { AuditWritebackButton } from "../audit-writeback-button";
import { WorkflowGlassPanel } from "../layout/workflow-screen-shell";
import { WriterPageStack } from "../layout/writer-grid";
import { DaemonClientError } from "../daemon-client";
import { syncScrollEdgeMask } from "../lib/sync-scroll-edge-mask";
import { useWorkspace } from "../workspace-context";

const AUDIT_DETAIL_POLL_INTERVAL_MS = 2000;

type AuditDetailLoadState = "loading" | "ready" | "error";

function AuditDetailPageShell({
  title,
  scrollSyncKey,
  children
}: {
  title: string;
  scrollSyncKey: string | number;
  children: ReactNode;
}) {
  const contentScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollEl = contentScrollRef.current;
    if (!scrollEl) {
      return;
    }

    const sync = () => syncScrollEdgeMask(scrollEl);

    sync();
    const raf = requestAnimationFrame(sync);
    scrollEl.addEventListener("scroll", sync, { passive: true });

    const resizeObserver = new ResizeObserver(sync);
    resizeObserver.observe(scrollEl);

    const mutationObserver = new MutationObserver(sync);
    mutationObserver.observe(scrollEl, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(raf);
      scrollEl.removeEventListener("scroll", sync);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [scrollSyncKey]);

  return (
    <div className="audit-detail-page flex h-full min-h-0 flex-col overflow-hidden">
      <WriterPageSubheader title={title} backTo="/audits" backLabel="Back to Audits Log" />

      <div className="writer-page-content-inset writer-content-fade-in flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="writer-chat-scroll-region relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <div
            ref={contentScrollRef}
            className="writer-chat-scroll audit-detail-content-scroll h-full min-h-0"
          >
            <div className="writer-page-subheader-content-gap">
              <WriterPageStack gap={4}>{children}</WriterPageStack>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [loadState, setLoadState] = useState<AuditDetailLoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setLoadState("error");
      setLoadError("Missing audit session id.");
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    function stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    function startPolling() {
      if (pollTimer) {
        return;
      }

      pollTimer = setInterval(() => {
        void refresh().then((nextSession) => {
          if (cancelled || !nextSession) {
            return;
          }

          if (deriveAuditRunStatus(nextSession).variant !== "in_progress") {
            stopPolling();
          }
        });
      }, AUDIT_DETAIL_POLL_INTERVAL_MS);
    }

    async function refresh(): Promise<ReviewSession | null> {
      try {
        const [nextSession, queue] = await Promise.all([
          daemonClient.getSession(sessionId),
          daemonClient.getReviewQueue(sessionId)
        ]);

        if (cancelled) {
          return null;
        }

        setSession(nextSession);
        setChanges(queue.changes);
        setLoadState("ready");
        setLoadError(null);
        return nextSession;
      } catch (error) {
        if (cancelled) {
          return null;
        }

        setSession(null);
        setLoadState("error");
        setLoadError(
          error instanceof DaemonClientError ? error.message : "Could not load this audit session."
        );
        return null;
      }
    }

    void refresh().then((nextSession) => {
      if (cancelled) {
        return;
      }

      if (nextSession && deriveAuditRunStatus(nextSession).variant === "in_progress") {
        startPolling();
      }
    });

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [daemonClient, sessionId]);

  const frameIds = useMemo(() => (session ? frameIdsForSession(session) : []), [session]);

  const pageTitle = formatAuditDetailPageTitle(session);

  const frameLabelsById = useMemo(() => {
    if (!session) {
      return {} as Record<string, string>;
    }

    return Object.fromEntries(
      frameIds.map((frameId) => [frameId, resolveFigmaFrameDisplayName(session, frameId)])
    );
  }, [frameIds, session]);

  const rows = changes.map((change) => ({
    changeId: change.id,
    finalText: editsByChange[change.id] ?? change.after
  }));

  const scrollSyncKey =
    loadState === "ready" && session
      ? `${session.id}-${changes.length}-${frameIds.length}-${deriveAuditRunStatus(session).variant}`
      : loadState;

  if (loadState === "loading") {
    return (
      <AuditDetailPageShell title={pageTitle} scrollSyncKey={scrollSyncKey}>
        <WorkflowGlassPanel>
          <p className="writer-home-text m-0 text-sm text-[#e5f1ff]/70">Loading audit…</p>
        </WorkflowGlassPanel>
      </AuditDetailPageShell>
    );
  }

  if (loadState === "error" || !session) {
    return (
      <AuditDetailPageShell title={pageTitle} scrollSyncKey={scrollSyncKey}>
        <InlineAlert
          kind="error"
          title="Could not open audit"
          subtitle={loadError ?? "This audit session could not be loaded."}
        />
      </AuditDetailPageShell>
    );
  }

  const { nodeCount, diagnosticMessage } = extractionSummary(session);

  return (
    <AuditDetailPageShell title={pageTitle} scrollSyncKey={scrollSyncKey}>
      {deriveAuditRunStatus(session).variant === "in_progress" ? (
        <InlineAlert
          kind="info"
          title="Audit in progress"
          subtitle="Findings will appear here when the run finishes. This page refreshes automatically."
        />
      ) : null}

      <AuditSessionDetailsAccordion
        session={session}
        guidelinesLabel={activeLayerLabel(session)}
        nodeCount={nodeCount}
        reviewRowCount={changes.length}
      />

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

      {frameIds.map((frameId) => (
        <AuditDetailFrameSection
          key={frameId}
          client={daemonClient}
          session={session}
          frameId={frameId}
          frameLabel={frameLabelsById[frameId] ?? frameId}
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
    </AuditDetailPageShell>
  );
}
