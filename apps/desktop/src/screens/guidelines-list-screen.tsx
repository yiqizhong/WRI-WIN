import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type { ReviewSession } from "@writer/contracts";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/writer/glass-card";
import { WriterPageSubheader } from "@/components/writer/writer-page-subheader";
import { formatProductDisplayName } from "@/lib/writer-product-display";

import {
  auditRunStatusBadgeClassName,
  deriveGuidelineRunStatus,
  formatAuditCreatedDate,
  formatGuidelineFilesDisplay,
  hasInProgressGuideline,
  sortFigmaGuidelineSessions
} from "../guideline-run-status";
import { syncScrollEdgeMask } from "../lib/sync-scroll-edge-mask";
import { useWorkspace } from "../workspace-context";

const GUIDELINES_POLL_INTERVAL_MS = 2000;

export function GuidelinesListScreen() {
  const { daemonClient, workspaceProjectId } = useWorkspace();
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const refreshSessions = useCallback(async (): Promise<ReviewSession[]> => {
    if (!workspaceProjectId) {
      setSessions([]);
      return [];
    }

    const list = await daemonClient.listSessions(workspaceProjectId);
    const guidelineSessions = sortFigmaGuidelineSessions(list.sessions);
    setSessions(guidelineSessions);
    return guidelineSessions;
  }, [daemonClient, workspaceProjectId]);

  useEffect(() => {
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
        void refreshSessions().then((guidelineSessions) => {
          if (cancelled) {
            return;
          }

          if (!hasInProgressGuideline(guidelineSessions)) {
            stopPolling();
          }
        });
      }, GUIDELINES_POLL_INTERVAL_MS);
    }

    void refreshSessions().then((guidelineSessions) => {
      if (cancelled) {
        return;
      }

      if (hasInProgressGuideline(guidelineSessions)) {
        startPolling();
      }
    });

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [refreshSessions]);

  useEffect(() => {
    const scrollEl = tableScrollRef.current;
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
  }, [sessions]);

  return (
    <div className="audits-log-page flex h-full min-h-0 flex-col overflow-hidden">
      <WriterPageSubheader
        title="Guidelines Log"
        backTo="/guide"
        backLabel="Back to Generate writing guidelines"
      />

      <div className="writer-page-content-inset writer-content-fade-in flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="writer-chat-scroll-region relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <div
            ref={tableScrollRef}
            className="writer-chat-scroll writer-audits-log-table-scroll h-full min-h-0"
          >
            <div className="writer-page-subheader-content-gap flex flex-col pb-6">
              <GlassCard variant="outline" className="w-full shrink-0 p-0">
                <table className="writer-audits-log-table writer-home-text w-full text-left text-sm">
                  <thead className="border-b border-white/10 text-[#e5f1ff]/70">
                    <tr>
                      <th className="writer-audits-log-table__feature px-4 py-3 font-normal">Feature</th>
                      <th className="px-4 py-3 font-normal">Product</th>
                      <th className="px-4 py-3 font-normal">Mode</th>
                      <th className="px-4 py-3 font-normal">Status</th>
                      <th className="px-4 py-3 font-normal">Files</th>
                      <th className="px-4 py-3 font-normal">Created</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-[#e5f1ff]/60">
                          No guideline generations yet.
                        </td>
                      </tr>
                    ) : null}
                    {sessions.map((session) => {
                      const status = deriveGuidelineRunStatus(session);

                      return (
                        <tr
                          key={session.id}
                          className="border-b border-white/5 transition-colors hover:bg-white/5"
                        >
                          <td className="writer-audits-log-table__feature px-4 py-3">
                            {session.featureName}
                          </td>
                          <td className="px-4 py-3">
                            {session.productId ? formatProductDisplayName(session.productId) : "—"}
                          </td>
                          <td className="px-4 py-3">{session.mode ?? "single_frame"}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={auditRunStatusBadgeClassName(status.variant)}>
                              {status.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">{formatGuidelineFilesDisplay(session)}</td>
                          <td className="px-4 py-3">{formatAuditCreatedDate(session.createdAt)}</td>
                          <td className="px-4 py-3">
                            <Link
                              to={`/guide/log/${session.id}`}
                              className="writer-text-action-link writer-home-text"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </GlassCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
