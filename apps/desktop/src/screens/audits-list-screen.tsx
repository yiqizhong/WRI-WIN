import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { ReviewSession } from "@writer/contracts";
import { deriveAuditRunBadge, isFigmaAuditSession } from "../audit-run-status";
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
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/figma-audit")}
          className="writer-home-text inline-flex items-center gap-2 text-sm text-[#e5f1ff]/75"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </button>
        <h1 className="writer-home-text text-lg text-[#e5f1ff]">Audits</h1>
      </div>

      <div className="overflow-auto rounded-md border border-white/10">
        <table className="w-full text-left text-sm text-[#e5f1ff]">
          <thead className="border-b border-white/10 text-[#e5f1ff]/70">
            <tr>
              <th className="px-4 py-3">Feature</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => {
              const badge = deriveAuditRunBadge(session);
              return (
                <tr key={session.id} className="border-b border-white/5">
                  <td className="px-4 py-3">{session.featureName}</td>
                  <td className="px-4 py-3">{session.productId ?? "—"}</td>
                  <td className="px-4 py-3">{session.mode ?? "single_frame"}</td>
                  <td className="px-4 py-3">{badge.label}</td>
                  <td className="px-4 py-3">{new Date(session.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/audits/${session.id}`}
                      className="inline-flex h-8 items-center rounded-md bg-white/10 px-3 text-sm text-[#e5f1ff] hover:bg-white/20"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
