import { useEffect, useState } from "react";

import type { AgentAdapter, McpServer } from "@writer/contracts";

import type { DaemonClient } from "./daemon-client";
import { AgentTestStatusBanner, type AgentTestStatus } from "./agent-test-status";
import { formatConnectionDiagnostic, summarizeMcpTools } from "./connection-diagnostics";

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
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [busyAdapterId, setBusyAdapterId] = useState<string | null>(null);
  const [busyMcpId, setBusyMcpId] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<AgentTestStatus | null>(null);

  useEffect(() => {
    if (!connected) {
      return;
    }

    void refreshDetection();
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
    setTestStatus({
      kind: "info",
      text: `Testing ${adapterId}… CLI agents may take up to 45 seconds.`
    });

    try {
      const result = await client.smokeAgent(adapterId);
      if (result.ok) {
        const summary = `${adapterId} connection OK${result.output ? `: ${result.output.slice(0, 120)}` : ""}.`;
        setTestStatus({ kind: "success", text: summary });
        onMessage(summary);
      } else {
        const diagnostic = formatConnectionDiagnostic(result.diagnostic);
        const summary = diagnostic ?? result.message ?? `${adapterId} smoke test failed.`;
        setTestStatus({ kind: "error", text: summary });
        onMessage(summary);
      }
    } catch (error) {
      const summary =
        error instanceof Error && error.name === "AbortError"
          ? "Smoke test timed out. Check that the agent CLI is installed and responding."
          : error instanceof Error
            ? error.message
            : "Smoke test failed.";
      setTestStatus({ kind: "error", text: summary });
      onMessage(summary);
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

  async function testFigmaRead(serverId: string) {
    setBusyMcpId(serverId);
    setTestStatus({ kind: "info", text: "Testing Figma MCP read…" });

    try {
      const result = await client.smokeFigmaRead();
      if (result.ok) {
        const summary = `Figma MCP read OK${result.toolName ? ` via ${result.toolName}` : ""}.`;
        setTestStatus({ kind: "success", text: summary });
        onMessage(summary);
      } else {
        const summary = formatConnectionDiagnostic(result.diagnostic) ?? "Figma MCP read smoke failed.";
        setTestStatus({ kind: "error", text: summary });
        onMessage(summary);
      }
    } catch (error) {
      const summary = error instanceof Error ? error.message : "Figma MCP read smoke failed.";
      setTestStatus({ kind: "error", text: summary });
      onMessage(summary);
    } finally {
      setBusyMcpId(null);
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

      <AgentTestStatusBanner status={testStatus} />

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
                    {formatConnectionDiagnostic(adapter.diagnostic) ? (
                      <p className={`connection-diagnostic connection-diagnostic-${adapter.diagnostic?.severity ?? "info"}`}>
                        {formatConnectionDiagnostic(adapter.diagnostic)}
                      </p>
                    ) : null}
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
                <div className="mcp-server-row">
                  <label className="mcp-toggle">
                    <input
                      type="checkbox"
                      checked={server.enabled}
                      onChange={(event) => void toggleMcp(server.id, event.target.checked)}
                    />
                    <span>{server.name}</span>
                  </label>
                  <span className={`status-pill ${server.status === "connected" ? "status-approved" : "status-rejected"}`}>
                    {server.status}
                  </span>
                </div>
                {formatConnectionDiagnostic(server.diagnostic) ? (
                  <p className={`connection-diagnostic connection-diagnostic-${server.diagnostic?.severity ?? "info"}`}>
                    {formatConnectionDiagnostic(server.diagnostic)}
                  </p>
                ) : server.errorMessage ? (
                  <p className="connection-diagnostic connection-diagnostic-error">{server.errorMessage}</p>
                ) : null}
                <p className="mcp-tools">Tools: {summarizeMcpTools(server.tools)}</p>
                {server.id === "figma" ? (
                  <button
                    className="secondary-action"
                    disabled={!connected || busyMcpId === server.id}
                    onClick={() => void testFigmaRead(server.id)}
                  >
                    {busyMcpId === server.id ? "Testing…" : "Test Figma read"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
