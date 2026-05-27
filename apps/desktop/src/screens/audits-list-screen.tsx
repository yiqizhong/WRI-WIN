import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import type { ReviewSession } from "@writer/contracts";
import { GlassCard } from "@/components/writer/glass-card";
import { WriterPageSubheader } from "@/components/writer/writer-page-subheader";
import { formatProductDisplayName } from "@/lib/writer-product-display";

import { deriveAuditRunBadge, isFigmaAuditSession } from "../audit-run-status";
import { WorkflowScreenShell } from "../layout/workflow-screen-shell";
import { useWorkspace } from "../workspace-context";

export function AuditsListScreen() {
  const { daemonClient, workspaceProjectId } = useWorkspace();
  const [sessions, setSessions] = useState<ReviewSession[]>([]);

  useEffect(() => {
    if (!workspaceProjectId) {
      return;
    }

    void daemonClient.listSessions(workspaceProjectId).then((list) => {
      const figmaSessions = list.sessions
        .filter(isFigmaAuditSession)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      setSessions(figmaSessions);
    });
  }, [daemonClient, workspaceProjectId]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <WriterPageSubheader
        title="Audits Log"
        backTo="/figma-audit"
        backLabel="Back to Figma Audit"
      />

      <div className="writer-page-content-inset flex min-h-0 flex-1 flex-col">
        <WorkflowScreenShell className="writer-page-subheader-content-gap min-h-0 flex-1">
          <GlassCard variant="outline" className="overflow-auto p-0">
            <table className="writer-home-text w-full text-left text-sm">
              <thead className="border-b border-white/10 text-[#e5f1ff]/70">
                <tr>
                  <th className="px-4 py-3 font-normal">Feature</th>
                  <th className="px-4 py-3 font-normal">Product</th>
                  <th className="px-4 py-3 font-normal">Mode</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                  <th className="px-4 py-3 font-normal">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#e5f1ff]/60">
                      No audits yet.
                    </td>
                  </tr>
                ) : null}
                {sessions.map((session) => {
                  const badge = deriveAuditRunBadge(session);
                  return (
                    <tr key={session.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                      <td className="px-4 py-3">{session.featureName}</td>
                      <td className="px-4 py-3">
                        {session.productId ? formatProductDisplayName(session.productId) : "—"}
                      </td>
                      <td className="px-4 py-3">{session.mode ?? "single_frame"}</td>
                      <td className="px-4 py-3">{badge.label}</td>
                      <td className="px-4 py-3">{new Date(session.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/audits/${session.id}`}
                          className="writer-home-text inline-flex h-auto min-h-8 items-center rounded-full border border-white/20 px-4 py-2 text-sm transition-colors hover:bg-white/10"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </GlassCard>
        </WorkflowScreenShell>
      </div>
    </div>
  );
}
