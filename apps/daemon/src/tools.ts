import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { PermissionRequest, ToolList } from "@writer/contracts";
import { createDefaultToolRegistry } from "@writer/tool-runtime";

import type { DaemonState } from "./state";
import { requireApprovedChangeId } from "./review";

const executeToolInputSchema = z.object({
  toolId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  runId: z.string().min(1).optional(),
  changeId: z.string().min(1).optional(),
  args: z.record(z.string(), z.unknown()).optional()
});

const createPermissionRequestInputSchema = z.object({
  toolId: z.string().min(1),
  sessionId: z.string().min(1),
  runId: z.string().min(1).optional(),
  reason: z.string().min(1)
});

const toolRegistry = createDefaultToolRegistry();

export function getToolList(): ToolList {
  return { tools: toolRegistry.list() };
}

export async function createPermissionRequest(state: DaemonState, input: unknown): Promise<PermissionRequest> {
  const parsed = createPermissionRequestInputSchema.parse(input);
  const tool = toolRegistry.get(parsed.toolId);

  if (!tool) {
    throw new Error("Tool not found");
  }

  const request: PermissionRequest = {
    id: randomUUID(),
    toolId: tool.id,
    toolName: tool.name,
    risk: tool.risk,
    sessionId: parsed.sessionId,
    runId: parsed.runId,
    reason: parsed.reason,
    decision: "pending"
  };

  state.permissionRequests.push(request);
  state.store.appendAuditEntry({
    type: "tool_attempt",
    timestamp: new Date().toISOString(),
    actor: "system",
    summary: `Permission requested for ${tool.name}`,
    details: {
      requestId: request.id,
      toolId: tool.id,
      risk: tool.risk,
      sessionId: parsed.sessionId
    }
  });
  await state.store.save();

  return request;
}

export type ToolExecutionResult = {
  ok: boolean;
  toolId: string;
  output?: unknown;
  permissionRequestId?: string;
};

export async function executeTool(state: DaemonState, input: unknown): Promise<ToolExecutionResult> {
  const parsed = executeToolInputSchema.parse(input);
  const tool = toolRegistry.get(parsed.toolId);

  if (!tool) {
    throw new Error("Tool not found");
  }

  if (tool.id === "figma.write") {
    try {
      requireApprovedChangeId(state, parsed.changeId, parsed.sessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Write requires approved change ID.";
      return { ok: false, toolId: tool.id, output: { message } };
    }
  }

  if (toolRegistry.requiresPermission(tool.risk)) {
    const approved = state.permissionRequests.find(
      (request) =>
        request.toolId === tool.id &&
        request.decision === "approved" &&
        (!parsed.sessionId || request.sessionId === parsed.sessionId)
    );

    if (!approved) {
      const request = await createPermissionRequest(state, {
        toolId: tool.id,
        sessionId: parsed.sessionId ?? "unknown",
        runId: parsed.runId,
        reason: `Write tool ${tool.name} requires explicit approval.`
      });

      return {
        ok: false,
        toolId: tool.id,
        permissionRequestId: request.id
      };
    }
  }

  state.store.appendAuditEntry({
    type: "tool_attempt",
    timestamp: new Date().toISOString(),
    actor: "system",
    summary: `Executed ${tool.name}`,
    details: {
      toolId: tool.id,
      risk: tool.risk,
      sessionId: parsed.sessionId
    }
  });
  await state.store.save();

  if (tool.id === "filesystem.list") {
    return {
      ok: true,
      toolId: tool.id,
      output: { message: "Use POST /filesystem/list for directory listing." }
    };
  }

  if (tool.id === "figma.read") {
    return {
      ok: true,
      toolId: tool.id,
      output: { message: "Use GET /mcp/smoke/figma/read for Figma MCP read smoke." }
    };
  }

  if (tool.id === "figma.write") {
    return {
      ok: true,
      toolId: tool.id,
      output: { message: "Use POST /mcp/smoke/figma/write for Figma MCP write smoke." }
    };
  }

  return { ok: true, toolId: tool.id, output: parsed.args ?? {} };
}
