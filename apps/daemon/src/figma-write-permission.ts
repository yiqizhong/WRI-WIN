import { createPermissionRequest } from "./tools";
import { requireApprovedChangeId } from "./review";
import type { DaemonState } from "./state";

export type FigmaWritePermissionResult =
  | { ok: true }
  | { ok: false; message: string; permissionRequestId?: string };

export async function assertFigmaWritePermission(
  state: DaemonState,
  input: { sessionId: string; changeId: string; permissionRequestId?: string }
): Promise<FigmaWritePermissionResult> {
  try {
    requireApprovedChangeId(state, input.changeId, input.sessionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Write requires an approved change.";
    return { ok: false, message };
  }

  if (input.permissionRequestId) {
    const approved = state.permissionRequests.find(
      (request) =>
        request.id === input.permissionRequestId &&
        request.decision === "approved" &&
        request.toolId === "figma.write" &&
        request.sessionId === input.sessionId
    );

    if (!approved) {
      return {
        ok: false,
        message: "Figma write permission was not approved for this session.",
        permissionRequestId: input.permissionRequestId
      };
    }

    return { ok: true };
  }

  const approved = state.permissionRequests.find(
    (request) =>
      request.toolId === "figma.write" &&
      request.decision === "approved" &&
      request.sessionId === input.sessionId
  );

  if (approved) {
    return { ok: true };
  }

  const request = await createPermissionRequest(state, {
    toolId: "figma.write",
    sessionId: input.sessionId,
    reason: "Apply approved UX copy changes back to Figma."
  });

  return {
    ok: false,
    message: "Figma write requires explicit user approval.",
    permissionRequestId: request.id
  };
}
