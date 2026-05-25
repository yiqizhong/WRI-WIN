import type { ReviewChange, WritebackResult } from "@writer/contracts";

import type { DaemonClient } from "./daemon-client";

export async function transitionChangeForWriteback(
  client: DaemonClient,
  change: ReviewChange,
  finalText: string
): Promise<void> {
  if (change.status === "approved" || change.status === "edited") {
    if (finalText !== change.after) {
      await client.transitionChange({
        changeId: change.id,
        nextStatus: "edited",
        after: finalText
      });
    }

    return;
  }

  if (change.status === "failed") {
    await client.transitionChange({
      changeId: change.id,
      nextStatus: "queued_for_writeback",
      after: finalText
    });
    return;
  }

  if (change.status === "queued_for_writeback") {
    return;
  }

  if (change.status === "proposed") {
    await client.transitionChange({
      changeId: change.id,
      nextStatus: "approved",
      after: finalText
    });
    return;
  }

  throw new Error(`Cannot write back while change is ${change.status}.`);
}

export async function runFigmaWritebackWithPermission(
  client: DaemonClient,
  input: { sessionId: string; changeIds: string[]; permissionRequestId?: string }
): Promise<WritebackResult> {
  let result = await client.runFigmaWriteback(input);

  if (!result.permissionRequestId) {
    return result;
  }

  await client.decidePermission({
    requestId: result.permissionRequestId,
    decision: "approved"
  });

  return client.runFigmaWriteback({
    ...input,
    permissionRequestId: result.permissionRequestId
  });
}

export function summarizeWritebackResult(result: WritebackResult): string {
  const applied = result.results.filter((item) => item.status === "applied").length;
  const failed = result.results.filter((item) => item.status === "failed").length;
  const skipped = result.results.filter((item) => item.status === "skipped").length;

  if (applied > 0 && failed === 0) {
    return skipped > 0
      ? `Writeback complete: ${applied} applied, ${skipped} skipped (unchanged copy).`
      : "Writeback complete.";
  }

  if (applied > 0 && failed > 0) {
    return `Partial writeback: ${applied} applied, ${failed} failed.`;
  }

  if (failed > 0) {
    const detail = result.results.find((item) => item.status === "failed")?.message;
    return detail ? `Writeback failed: ${detail}` : `Writeback failed (${failed} items).`;
  }

  if (skipped > 0) {
    const detail = result.results.find((item) => item.status === "skipped")?.message;
    return (
      detail ??
      "Nothing written — edit the copy in the table so “after” differs from Figma, then try again."
    );
  }

  return "Writeback finished with no updates.";
}
