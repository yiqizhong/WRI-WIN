import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type { ReviewSession } from "@writer/contracts";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/writer/glass-card";
import { WriterFormField, WriterFormSelect } from "@/components/writer/writer-form-field";
import { WriterPageSubheader } from "@/components/writer/writer-page-subheader";
import { formatProductDisplayName } from "@/lib/writer-product-display";

import {
  auditRunStatusBadgeClassName,
  deriveAuditRunStatus,
  deriveWritebackDisplay,
  formatAuditCreatedDate,
  isFigmaAuditSession
} from "../audit-run-status";
import { syncScrollEdgeMask } from "../lib/sync-scroll-edge-mask";
import { useWorkspace } from "../workspace-context";

const AUDITS_POLL_INTERVAL_MS = 2000;
const ALL_FILTER_VALUE = "__all__";

function sortFigmaAuditSessions(sessions: ReviewSession[]): ReviewSession[] {
  return sessions
    .filter(isFigmaAuditSession)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function hasInProgressAudit(sessions: ReviewSession[]): boolean {
  return sessions.some((entry) => deriveAuditRunStatus(entry).variant === "in_progress");
}

function productFilterLabel(session: ReviewSession): string {
  return session.productId ? formatProductDisplayName(session.productId) : "General purpose";
}

export function AuditsListScreen() {
  const { daemonClient, workspaceProjectId } = useWorkspace();
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [productFilter, setProductFilter] = useState(ALL_FILTER_VALUE);
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER_VALUE);
  const [figmaSyncFilter, setFigmaSyncFilter] = useState(ALL_FILTER_VALUE);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const refreshSessions = useCallback(async (): Promise<ReviewSession[]> => {
    if (!workspaceProjectId) {
      setSessions([]);
      return [];
    }

    const list = await daemonClient.listSessions(workspaceProjectId);
    const figmaSessions = sortFigmaAuditSessions(list.sessions);
    setSessions(figmaSessions);
    return figmaSessions;
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
        void refreshSessions().then((figmaSessions) => {
          if (cancelled) {
            return;
          }

          if (!hasInProgressAudit(figmaSessions)) {
            stopPolling();
          }
        });
      }, AUDITS_POLL_INTERVAL_MS);
    }

    void refreshSessions().then((figmaSessions) => {
      if (cancelled) {
        return;
      }

      if (hasInProgressAudit(figmaSessions)) {
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

  const productOptions = useMemo(() => {
    const values = Array.from(new Set(sessions.map(productFilterLabel))).sort((a, b) => a.localeCompare(b));
    return [
      { value: ALL_FILTER_VALUE, label: "All products" },
      ...values.map((value) => ({ value, label: value }))
    ];
  }, [sessions]);

  const statusOptions = useMemo(() => {
    const values = Array.from(new Set(sessions.map((session) => deriveAuditRunStatus(session).label)));
    const order = ["In Progress", "Done", "Fail"];
    values.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return [
      { value: ALL_FILTER_VALUE, label: "All statuses" },
      ...values.map((value) => ({ value, label: value }))
    ];
  }, [sessions]);

  const figmaSyncOptions = useMemo(() => {
    const values = Array.from(new Set(sessions.map((session) => deriveWritebackDisplay(session).label))).sort(
      (a, b) => a.localeCompare(b)
    );
    return [
      { value: ALL_FILTER_VALUE, label: "All Figma sync" },
      ...values.map((value) => ({ value, label: value }))
    ];
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (productFilter !== ALL_FILTER_VALUE && productFilterLabel(session) !== productFilter) {
        return false;
      }

      if (statusFilter !== ALL_FILTER_VALUE && deriveAuditRunStatus(session).label !== statusFilter) {
        return false;
      }

      if (
        figmaSyncFilter !== ALL_FILTER_VALUE &&
        deriveWritebackDisplay(session).label !== figmaSyncFilter
      ) {
        return false;
      }

      return true;
    });
  }, [sessions, productFilter, statusFilter, figmaSyncFilter]);

  return (
    <div className="audits-log-page flex h-full min-h-0 flex-col overflow-hidden">
      <WriterPageSubheader
        title="Audits Log"
        backTo="/figma-audit"
        backLabel="Back to Figma Audit"
      />

      <div className="writer-page-content-inset writer-content-fade-in flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="writer-chat-scroll-region relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <div
            ref={tableScrollRef}
            className="writer-chat-scroll writer-audits-log-table-scroll h-full min-h-0"
          >
            <div className="writer-page-subheader-content-gap flex flex-col pb-6">
              <GlassCard variant="outline" className="mb-3 p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <WriterFormField label="Product">
                    <WriterFormSelect
                      value={productFilter}
                      options={productOptions}
                      onValueChange={setProductFilter}
                      displayValue={productOptions.find((option) => option.value === productFilter)?.label ?? ""}
                    />
                  </WriterFormField>

                  <WriterFormField label="Status">
                    <WriterFormSelect
                      value={statusFilter}
                      options={statusOptions}
                      onValueChange={setStatusFilter}
                      displayValue={statusOptions.find((option) => option.value === statusFilter)?.label ?? ""}
                    />
                  </WriterFormField>

                  <WriterFormField label="Figma sync">
                    <WriterFormSelect
                      value={figmaSyncFilter}
                      options={figmaSyncOptions}
                      onValueChange={setFigmaSyncFilter}
                      displayValue={
                        figmaSyncOptions.find((option) => option.value === figmaSyncFilter)?.label ?? ""
                      }
                    />
                  </WriterFormField>
                </div>
              </GlassCard>

              <GlassCard variant="outline" className="w-full shrink-0 p-0">
                <table className="writer-audits-log-table writer-home-text w-full text-left text-sm">
                  <thead className="border-b border-white/10 text-[#e5f1ff]/70">
                    <tr>
                      <th className="writer-audits-log-table__feature px-4 py-3 font-normal">Feature</th>
                      <th className="px-4 py-3 font-normal">Product</th>
                      <th className="px-4 py-3 font-normal">Mode</th>
                      <th className="px-4 py-3 font-normal">Status</th>
                      <th className="px-4 py-3 font-normal">Figma sync</th>
                      <th className="px-4 py-3 font-normal">Created</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-[#e5f1ff]/60">
                          {sessions.length === 0 ? "No audits yet." : "No audits match the selected filters."}
                        </td>
                      </tr>
                    ) : null}
                    {filteredSessions.map((session) => {
                      const status = deriveAuditRunStatus(session);
                      const writeback = deriveWritebackDisplay(session);

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
                          <td className="px-4 py-3">{writeback.label}</td>
                          <td className="px-4 py-3">{formatAuditCreatedDate(session.createdAt)}</td>
                          <td className="px-4 py-3">
                            <Link
                              to={`/audits/${session.id}`}
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
