import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { ReviewSession } from "@writer/contracts";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/writer/glass-card";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";

import { deriveAuditRunBadge, isFigmaAuditSession } from "../audit-run-status";
import {
  WorkflowBackLink,
  WorkflowPageIntro,
  WorkflowScreenShell
} from "../layout/workflow-screen-shell";
import { useWorkspace } from "../workspace-context";

export function AuditsListScreen() {
  const navigate = useNavigate();
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
    <WorkflowScreenShell>
      <WorkflowBackLink to="/figma-audit" label="Back" />
      <WorkflowPageIntro
        title="Audits"
        description="Past Figma audit sessions for this workspace."
        actions={
          <WriterPrimaryButton type="button" onClick={() => navigate("/figma-audit")}>
            New audit
          </WriterPrimaryButton>
        }
      />

      <GlassCard variant="outline" className="overflow-auto p-0">
        <table className="writer-home-text w-full text-left text-sm">
          <thead className="border-b border-white/10 text-[#e5f1ff]/70">
            <tr>
              <th className="px-4 py-3 font-normal tracking-wide">Feature</th>
              <th className="px-4 py-3 font-normal tracking-wide">Product</th>
              <th className="px-4 py-3 font-normal tracking-wide">Mode</th>
              <th className="px-4 py-3 font-normal tracking-wide">Status</th>
              <th className="px-4 py-3 font-normal tracking-wide">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#e5f1ff]/60">
                  No audits yet.{" "}
                  <Link to="/figma-audit" className="text-[#e5f1ff] underline-offset-2 hover:underline">
                    Start one
                  </Link>
                </td>
              </tr>
            ) : null}
            {sessions.map((session) => {
              const badge = deriveAuditRunBadge(session);
              return (
                <tr key={session.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                  <td className="px-4 py-3">{session.featureName}</td>
                  <td className="px-4 py-3">{session.productId ?? "—"}</td>
                  <td className="px-4 py-3">{session.mode ?? "single_frame"}</td>
                  <td className="px-4 py-3">{badge.label}</td>
                  <td className="px-4 py-3">{new Date(session.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/audits/${session.id}`}
                      className="writer-home-text inline-flex h-8 items-center rounded-md border border-white/20 px-3 text-sm transition-colors hover:bg-white/10"
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
  );
}
