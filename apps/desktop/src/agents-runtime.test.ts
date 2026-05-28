import { describe, expect, it } from "vitest";

import type { AgentAdapter } from "@writer/contracts";

import {
  applyAgentAdapterList,
  isAdapterStatusLoading,
  LLM_PROVIDER_PLACEHOLDERS,
  MCP_SERVER_PLACEHOLDERS,
  mergeLlmAdapters,
  mergeMcpServers
} from "./agents-runtime";

describe("agents-runtime", () => {
  it("keeps both provider slots when daemon returns partial data", () => {
    const merged = mergeLlmAdapters(LLM_PROVIDER_PLACEHOLDERS, [
      {
        id: "cursor-agent",
        displayName: "Cursor",
        available: true,
        executablePath: "/usr/local/bin/cursor",
        capabilities: []
      }
    ]);

    expect(merged).toHaveLength(2);
    expect(merged[0]?.available).toBe(true);
    expect(merged[1]?.id).toBe("devin");
  });

  it("overrides stale daemon display names for LLM adapters", () => {
    const merged = mergeLlmAdapters(LLM_PROVIDER_PLACEHOLDERS, [
      {
        id: "cursor-agent",
        displayName: "Cursor Agent",
        available: true,
        capabilities: []
      },
      {
        id: "devin",
        displayName: "Devin (cloud-backed)",
        available: true,
        capabilities: []
      }
    ]);

    expect(merged[0]?.displayName).toBe("Cursor");
    expect(merged[1]?.displayName).toBe("Devin");
  });

  it("preserves previous adapter details while refreshing", () => {
    const previous: AgentAdapter[] = [
      {
        id: "cursor-agent",
        displayName: "Cursor",
        available: true,
        executablePath: "/usr/local/bin/cursor",
        capabilities: []
      },
      {
        id: "devin",
        displayName: "Devin",
        available: true,
        executablePath: "/Users/me/.local/bin/devin",
        capabilities: []
      }
    ];

    const merged = mergeLlmAdapters(previous, []);
    expect(merged[0]?.executablePath).toBe("/usr/local/bin/cursor");
    expect(merged[1]?.executablePath).toBe("/Users/me/.local/bin/devin");
  });

  it("shows loading until adapter details exist", () => {
    expect(isAdapterStatusLoading(LLM_PROVIDER_PLACEHOLDERS[0]!, "loading", false, true)).toBe(true);
    expect(
      isAdapterStatusLoading(
        { ...LLM_PROVIDER_PLACEHOLDERS[0]!, setupMessage: "ready" },
        "loading",
        false,
        true
      )
    ).toBe(false);
    expect(isAdapterStatusLoading(LLM_PROVIDER_PLACEHOLDERS[0]!, "idle", false, false)).toBe(false);
  });

  it("keeps figma mcp slot when daemon returns empty list", () => {
    const merged = mergeMcpServers(MCP_SERVER_PLACEHOLDERS, []);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("figma");
  });

  it("applyAgentAdapterList updates active adapter id", () => {
    const result = applyAgentAdapterList(LLM_PROVIDER_PLACEHOLDERS, {
      adapters: [
        {
          id: "devin",
          displayName: "Devin",
          available: true,
          capabilities: []
        }
      ],
      activeAdapterId: "devin"
    });

    expect(result.activeAdapterId).toBe("devin");
    expect(result.llmAdapters.some((adapter: { id: string }) => adapter.id === "cursor-agent")).toBe(true);
  });
});
