import { useEffect, useState } from "react";

import type { AgentAdapter } from "@writer/contracts";

import type { DaemonClient } from "./daemon-client";

type AgentsPanelProps = {
  client: DaemonClient;
  connected: boolean;
  onMessage: (message: string) => void;
};

function runtimeLabel(adapter: AgentAdapter): string | null {
  if (adapter.runtimeKind === "hybrid") {
    return "Cloud-backed";
  }

  if (adapter.runtimeKind === "local") {
    return "Local CLI";
  }

  return null;
}

export function AgentsPanel({ client, connected, onMessage }: AgentsPanelProps) {
  const [adapters, setAdapters] = useState<AgentAdapter[]>([]);
  const [activeAdapterId, setActiveAdapterId] = useState<string | null>(null);
  const [mcpServers, setMcpServers] = useState<Array<{ id: string; name: string; enabled: boolean }>>([]);
  const [busyAdapterId, setBusyAdapterId] = useState<string | null>(null);

  async function loadAgents() {
    try {
      const agentList = await client.listAgents();
      setAdapters(agentList.adapters);
      setActiveAdapterId(agentList.activeAdapterId);
    } catch {
      setAdapters([]);
    }
  }

  useEffect(() => {
    if (!connected) {
      return;
    }

    void loadAgents();
    void (async () => {
      try {
        const mcpList = await client.listMcpServers();
        setMcpServers(mcpList.servers);
      } catch {
        setMcpServers([]);
      }
    })();
  }, [client, connected]);

  async function refreshDetection() {
    try {
      const agentList = await client.refreshAgents();
      setAdapters(agentList.adapters);
      setActiveAdapterId(agentList.activeAdapterId);
      onMessage("Agent detection refreshed.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not refresh agents.");
    }
  }

  async function selectAdapter(adapterId: string) {
    try {
      const result = await client.setActiveAdapter(adapterId);
      setActiveAdapterId(result.activeAdapterId);
      onMessage(`Active adapter: ${result.activeAdapterId}`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not set adapter.");
    }
  }

  async function testConnection(adapterId: string) {
    setBusyAdapterId(adapterId);

    try {
      const result = await client.smokeAgent(adapterId);
      if (result.ok) {
        onMessage(`${adapterId} connection OK${result.output ? `: ${result.output.slice(0, 80)}` : ""}.`);
      } else {
        onMessage(result.message ?? `${adapterId} smoke test failed.`);
      }
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Smoke test failed.");
    } finally {
      setBusyAdapterId(null);
    }
  }

  async function toggleMcp(serverId: string, enabled: boolean) {
    try {
      const result = await client.setMcpServerEnabled(serverId, enabled);
      setMcpServers(result.servers);
      onMessage(`${serverId} ${enabled ? "enabled" : "disabled"}.`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not update MCP server.");
    }
  }

  return (
    <section className="panel agents-panel">
      <div className="agents-panel-header">
        <div>
          <p className="eyebrow">Runtime</p>
          <h2>Agents and MCP</h2>
        </div>
        <button className="secondary-action" disabled={!connected} onClick={() => void refreshDetection()}>
          Refresh detection
        </button>
      </div>

      <div className="agents-grid">
        <div>
          <h3>LLM providers</h3>
          <ul className="settings-list agent-card-list">
            {adapters
              .filter((adapter) => adapter.id !== "echo")
              .map((adapter) => {
                const label = runtimeLabel(adapter);

                return (
                  <li key={adapter.id} className="agent-card">
                    <div className="agent-card-head">
                      <strong>{adapter.displayName}</strong>
                      {label ? <span className="runtime-badge">{label}</span> : null}
                      <span className={adapter.available ? "status-pill status-approved" : "status-pill status-rejected"}>
                        {adapter.available ? "available" : "unavailable"}
                      </span>
                    </div>
                    {adapter.setupMessage ? <p className="agent-setup">{adapter.setupMessage}</p> : null}
                    {adapter.executablePath ? (
                      <p className="agent-path">{adapter.executablePath}</p>
                    ) : null}
                    <div className="agent-card-actions">
                      <button
                        className={adapter.id === activeAdapterId ? "secondary-action active-chip" : "secondary-action"}
                        disabled={!adapter.available}
                        onClick={() => void selectAdapter(adapter.id)}
                      >
                        Use adapter
                      </button>
                      <button
                        className="secondary-action"
                        disabled={!adapter.available || busyAdapterId === adapter.id}
                        onClick={() => void testConnection(adapter.id)}
                      >
                        {busyAdapterId === adapter.id ? "Testing…" : "Test connection"}
                      </button>
                    </div>
                  </li>
                );
              })}
          </ul>
        </div>

        <div>
          <h3>MCP servers</h3>
          <ul className="settings-list">
            {mcpServers.map((server) => (
              <li key={server.id}>
                <label className="mcp-toggle">
                  <input
                    type="checkbox"
                    checked={server.enabled}
                    onChange={(event) => void toggleMcp(server.id, event.target.checked)}
                  />
                  <span>{server.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
