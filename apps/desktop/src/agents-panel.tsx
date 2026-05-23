import { useEffect, useState } from "react";

import type { DaemonClient } from "./daemon-client";

type AgentsPanelProps = {
  client: DaemonClient;
  connected: boolean;
};

export function AgentsPanel({ client, connected }: AgentsPanelProps) {
  const [adapters, setAdapters] = useState<Array<{ id: string; displayName: string; available: boolean }>>([]);
  const [activeAdapterId, setActiveAdapterId] = useState<string | null>(null);
  const [mcpServers, setMcpServers] = useState<Array<{ id: string; name: string; enabled: boolean }>>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) {
      return;
    }

    void (async () => {
      try {
        const [agentList, mcpList] = await Promise.all([client.listAgents(), client.listMcpServers()]);
        setAdapters(agentList.adapters);
        setActiveAdapterId(agentList.activeAdapterId);
        setMcpServers(mcpList.servers);
      } catch {
        setAdapters([]);
        setMcpServers([]);
      }
    })();
  }, [client, connected]);

  async function selectAdapter(adapterId: string) {
    try {
      const result = await client.setActiveAdapter(adapterId);
      setActiveAdapterId(result.activeAdapterId);
      setMessage(`Active adapter: ${result.activeAdapterId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not set adapter.");
    }
  }

  async function toggleMcp(serverId: string, enabled: boolean) {
    try {
      const result = await client.setMcpServerEnabled(serverId, enabled);
      setMcpServers(result.servers);
      setMessage(`${serverId} ${enabled ? "enabled" : "disabled"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update MCP server.");
    }
  }

  return (
    <section className="panel agents-panel">
      <p className="eyebrow">Runtime</p>
      <h2>Agents and MCP</h2>
      {message ? <p className="project-banner">{message}</p> : null}

      <div className="agents-grid">
        <div>
          <h3>Agent adapters</h3>
          <ul className="settings-list">
            {adapters.map((adapter) => (
              <li key={adapter.id}>
                <button
                  className={adapter.id === activeAdapterId ? "secondary-action active-chip" : "secondary-action"}
                  disabled={!adapter.available}
                  onClick={() => void selectAdapter(adapter.id)}
                >
                  {adapter.displayName}
                  {!adapter.available ? " (unavailable)" : ""}
                </button>
              </li>
            ))}
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
