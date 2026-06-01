import { BookOpen } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";

import type { ReviewSession } from "@writer/contracts";
import { InlineAlert } from "@/components/writer/inline-alert";
import { Badge } from "@/components/ui/badge";
import { WriterPageSubheader } from "@/components/writer/writer-page-subheader";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";
import { downloadTextFile } from "@/lib/download-text-file";
import { formatProductDisplayName } from "@/lib/writer-product-display";

import {
  auditRunStatusBadgeClassName,
  deriveGuidelineRunStatus,
  formatAuditCreatedDate,
  readGuidelineGenerationScope
} from "../guideline-run-status";
import { WorkflowGlassPanel } from "../layout/workflow-screen-shell";
import { WriterPageStack } from "../layout/writer-grid";
import { syncScrollEdgeMask } from "../lib/sync-scroll-edge-mask";
import { useWorkspace } from "../workspace-context";

type GuidelineDetailLoadState = "loading" | "ready" | "error";

function GuidelineDetailPageShell({
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
      <WriterPageSubheader title={title} backTo="/guide/log" backLabel="Back to Guidelines Log" />

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

export function GuidelineDetailScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { daemonClient, workspaceProjectId } = useWorkspace();
  const [loadState, setLoadState] = useState<GuidelineDetailLoadState>("loading");
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || !workspaceProjectId) {
      setLoadState("error");
      setErrorMessage("Missing session or workspace.");
      return;
    }

    let cancelled = false;
    setLoadState("loading");

    void daemonClient
      .getSession(sessionId)
      .then((loaded) => {
        if (cancelled) {
          return;
        }

        if (loaded.projectId !== workspaceProjectId) {
          setLoadState("error");
          setErrorMessage("Session not found in this workspace.");
          return;
        }

        setSession(loaded);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setLoadState("error");
        setErrorMessage(error instanceof Error ? error.message : "Could not load session.");
      });

    return () => {
      cancelled = true;
    };
  }, [daemonClient, sessionId, workspaceProjectId]);

  if (loadState === "loading") {
    return (
      <GuidelineDetailPageShell title="Guideline run" scrollSyncKey="loading">
        <p className="writer-home-section-description">Loading…</p>
      </GuidelineDetailPageShell>
    );
  }

  if (loadState === "error" || !session) {
    return (
      <GuidelineDetailPageShell title="Guideline run" scrollSyncKey="error">
        <InlineAlert
          kind="error"
          title="Could not open guideline run"
          subtitle={errorMessage ?? "Session not found."}
        />
      </GuidelineDetailPageShell>
    );
  }

  const status = deriveGuidelineRunStatus(session);
  const generation = readGuidelineGenerationScope(session);
  const files = generation?.files ?? [];
  const title = session.featureName ?? "Guideline run";

  return (
    <GuidelineDetailPageShell title={title} scrollSyncKey={session.id}>
      <div className="flex flex-wrap items-center gap-3 text-sm text-[#e5f1ff]/80">
        <Badge variant="outline" className={auditRunStatusBadgeClassName(status.variant)}>
          {status.label}
        </Badge>
        <span>Created {formatAuditCreatedDate(session.createdAt)}</span>
        {session.productId ? (
          <span>Product {formatProductDisplayName(session.productId)}</span>
        ) : null}
        <span>Mode {session.mode ?? "single_frame"}</span>
      </div>

      {session.description ? (
        <p className="writer-home-section-description max-w-2xl">{session.description}</p>
      ) : null}

      {generation?.ok === false || session.diagnostic ? (
        <InlineAlert
          kind="error"
          title="Generation did not complete"
          subtitle={session.diagnostic?.message ?? "This run did not produce a starter pack."}
        />
      ) : null}

      {files.length > 0 ? (
        <WorkflowGlassPanel
          title="Downloads"
          description="Files saved from this generation run."
          actions={
            <WriterPrimaryButton
              className="px-4"
              onClick={() => {
                for (const file of files) {
                  downloadTextFile(file.name, file.mimeType, file.content);
                }
              }}
            >
              Download all
            </WriterPrimaryButton>
          }
        >
          <ul className="grid gap-2">
            {files.map((file) => (
              <li
                key={file.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#e5f1ff]/10 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <BookOpen className="size-4 shrink-0 text-[#e5f1ff]/60" aria-hidden />
                  <span className="truncate text-sm text-[#e5f1ff]/88">{file.name}</span>
                </div>
                <WriterPrimaryButton
                  className="px-3 py-2 text-sm"
                  onClick={() => downloadTextFile(file.name, file.mimeType, file.content)}
                >
                  Download
                </WriterPrimaryButton>
              </li>
            ))}
          </ul>
        </WorkflowGlassPanel>
      ) : generation?.ok ? (
        <InlineAlert
          kind="info"
          title="Starter pack completed"
          subtitle="File contents were not stored for this run. Generate again from the guidelines screen to download files."
        />
      ) : (
        <InlineAlert
          kind="info"
          title="No files yet"
          subtitle="This session has not finished generating a starter pack."
        />
      )}
    </GuidelineDetailPageShell>
  );
}
