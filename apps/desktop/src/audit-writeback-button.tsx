import { useState } from "react";

import type { ReviewChange, ReviewSession } from "@writer/contracts";
import { Button } from "@/components/ui/button";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";

import type { DaemonClient } from "./daemon-client";
import {
  runFigmaWritebackWithPermission,
  summarizeWritebackResult,
  transitionChangeForWriteback
} from "./figma-writeback-flow";

export type AuditRowEdit = {
  changeId: string;
  finalText: string;
};

type AuditWritebackButtonProps = {
  client: DaemonClient;
  session: ReviewSession;
  rows: AuditRowEdit[];
  changes: ReviewChange[];
  disabled?: boolean;
  onComplete: () => void;
};

export function AuditWritebackButton({
  client,
  session,
  rows,
  changes,
  disabled,
  onComplete
}: AuditWritebackButtonProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const failedIds =
    session.writebackReport?.failed
      .map((item) => changes.find((change) => change.sourceId === item.nodeId)?.id)
      .filter((changeId): changeId is string => Boolean(changeId)) ?? [];

  async function runWriteback(targetChangeIds: string[]) {
    setBusy(true);
    setMessage(null);

    try {
      for (const row of rows) {
        if (!targetChangeIds.includes(row.changeId)) {
          continue;
        }

        const change = changes.find((item) => item.id === row.changeId);

        if (!change) {
          throw new Error("Review row not found. Refresh the page and try again.");
        }

        await transitionChangeForWriteback(client, change, row.finalText);
      }

      const result = await runFigmaWritebackWithPermission(client, {
        sessionId: session.id,
        changeIds: targetChangeIds
      });

      setMessage(summarizeWritebackResult(result));

      if (result.results.some((item) => item.status === "applied")) {
        onComplete();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Writeback request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <WriterPrimaryButton
        type="button"
        disabled={disabled || busy || rows.length === 0}
        onClick={() => void runWriteback(rows.map((row) => row.changeId))}
      >
        Approve & writeback to Figma
      </WriterPrimaryButton>
      {failedIds.length > 0 ? (
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || busy}
          onClick={() => void runWriteback(failedIds)}
        >
          Retry failed
        </Button>
      ) : null}
      {message ? <p className="text-sm text-[#e5f1ff]/80">{message}</p> : null}
    </div>
  );
}
