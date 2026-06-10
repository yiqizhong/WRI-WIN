import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveDevinModelId } from "@writer/agent-adapters";
import { PlatformStore } from "@writer/storage";
import { describe, expect, it } from "vitest";

import {
  getAgentAdapterList,
  getDevinProviderSettings,
  setActiveAdapter,
  smokeAgentAdapter,
  startAgentRun,
  updateDevinProviderSettings
} from "./agents";
import { createProject, createSession } from "./state";
import type { DaemonState } from "./state";

async function createTestState(): Promise<DaemonState> {
  const dataDir = await mkdtemp(join(tmpdir(), "writer-agents-"));
  const store = new PlatformStore({ dataDir });
  await store.load();

  return {
    store,
    permissionRequests: [],
    activeRuns: new Map(),
    mcp: {
      figma: {
        id: "figma",
        name: "Figma MCP",
        enabled: false,
        status: "disconnected",
        capabilities: ["figma.read", "figma.write"]
      }
    }
  };
}

describe("agent discovery and runs", () => {
  it("lists known adapters (LLM providers and local models)", async () => {
    const state = await createTestState();
    const list = await getAgentAdapterList(state);

    const knownIds = new Set(["devin", "local-gemma"]);
    expect(list.adapters.every((adapter) => knownIds.has(adapter.id))).toBe(true);
    expect(list.adapters.some((adapter) => adapter.id === "devin")).toBe(true);
    expect(list.adapters.some((adapter) => adapter.id === "local-gemma")).toBe(true);
    expect(list.adapters.some((adapter) => adapter.id === "cursor-agent")).toBe(false);
    expect(list.adapters.some((adapter) => adapter.id === "claude-code")).toBe(false);
    expect(list.adapters.some((adapter) => adapter.id === "codex")).toBe(false);
    expect(list.adapters.some((adapter) => adapter.id === "echo")).toBe(false);
    expect(list.activeAdapterId).toBeTruthy();
  });

  it("does not persist a fallback active adapter as a side effect of listing", async () => {
    // Listing adapters is a read. It may surface a fallback for display, but it
    // must not write that fallback to the store — otherwise a slow background
    // list can race a user's selection and silently pin the fallback.
    const state = await createTestState();
    expect(state.store.getActiveAdapterId()).toBeNull();

    await getAgentAdapterList(state);

    expect(state.store.getActiveAdapterId()).toBeNull();
  });

  it("does not overwrite an explicit selection when listing afterwards", async () => {
    const state = await createTestState();
    await setActiveAdapter(state, { adapterId: "devin" });

    const list = await getAgentAdapterList(state);

    expect(list.activeAdapterId).toBe("devin");
    expect(state.store.getActiveAdapterId()).toBe("devin");
  });

  it("persists active adapter across reload", async () => {
    const state = await createTestState();
    await setActiveAdapter(state, { adapterId: "devin" });

    const reloadedStore = new PlatformStore({ dataDir: state.store.dataDir });
    await reloadedStore.load();
    const list = await getAgentAdapterList({ ...state, store: reloadedStore });

    expect(list.activeAdapterId).toBe("devin");
  });

  it("rejects smoke for unknown adapter", async () => {
    const state = await createTestState();

    await expect(smokeAgentAdapter(state, { adapterId: "unknown-adapter" })).rejects.toThrow(
      /Unknown or unsupported/
    );
  });

  it("refuses to run the dev echo adapter from request input", async () => {
    // `echo` is registered for dev but is not a known/selectable adapter. A run
    // request must be gated on isKnownAdapterId so echo can never be spawned via
    // POST /agents/runs (it reaches cmd.exe on Windows). See agents.run-gate.test.ts.
    const state = await createTestState();
    const project = await createProject(state, { name: "Demo", rootPath: "/tmp/demo" });
    const session = await createSession(state, {
      projectId: project.id,
      sourceType: "figma",
      scope: { kind: "file", fileKey: "abc" }
    });

    await expect(
      startAgentRun(state, {
        sessionId: session.id,
        adapterId: "echo",
        prompt: "hello-writer"
      })
    ).rejects.toThrow(/not selectable/i);
  });

  it("persists devin provider settings and reports capability status", async () => {
    const state = await createTestState();

    const updated = await updateDevinProviderSettings(state, {
      modelId: "swe-1.6-fast",
      reasoningPreference: "high"
    });

    expect(updated.modelId).toBe("swe-1.6");
    expect(updated.reasoningPreference).toBe("high");
    expect(updated.reasoningCapabilityStatus).toBe("applied");

    const reloaded = getDevinProviderSettings(state);
    expect(reloaded.modelId).toBe("swe-1.6");
    expect(reloaded.reasoningPreference).toBe("high");
  });

  it("returns a valid curated model from store when model picker is enabled", async () => {
    const state = await createTestState();
    state.store.setDevinProviderSettings({
      modelId: "gpt-5.4",
      reasoningPreference: "medium",
      reasoningCapabilityStatus: "unsupported"
    });

    const settings = getDevinProviderSettings(state);
    expect(settings.modelId).toBe("gpt-5.4");
    expect(resolveDevinModelId()).toBe("gpt-5.4");
  });
});
