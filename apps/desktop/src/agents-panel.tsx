import { useEffect, useState } from "react";
import {
  Button,
  RadioButton,
  RadioButtonGroup,
  Stack,
  Tag,
  Tile,
  Toggle
} from "@carbon/react";
import { isLlmProviderAdapterId, type AgentAdapter, type McpServer } from "@writer/contracts";

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

  async function connectFigma(serverId: string) {
    setBusyMcpId(serverId);
    setTestStatus({ kind: "info", text: "Opening Figma sign-in…" });

    try {
      if (!mcpServers.find((server) => server.id === serverId)?.enabled) {
        await toggleMcp(serverId, true);
      }

      const result = await client.startFigmaMcpAuth();
      if (result.status === "redirect" && result.authorizationUrl) {
        if (window.writerDesktop?.openExternal) {
          await window.writerDesktop.openExternal(result.authorizationUrl);
        } else {
          window.open(result.authorizationUrl, "_blank", "noopener,noreferrer");
        }

        setTestStatus({
          kind: "info",
          text: "Finish sign-in in your browser, then return here. Writer will connect automatically."
        });
        onMessage("Figma sign-in opened in browser.");

        for (let attempt = 0; attempt < 60; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 2_000));
          const refreshed = await client.listMcpServers();
          setMcpServers(refreshed.servers);
          const figma = refreshed.servers.find((server) => server.id === "figma");
          if (figma?.status === "connected") {
            setTestStatus({ kind: "success", text: "Figma MCP connected." });
            onMessage("Figma MCP connected.");
            return;
          }
          if (figma?.status === "error") {
            const summary = formatConnectionDiagnostic(figma.diagnostic) ?? "Figma MCP sign-in failed.";
            setTestStatus({ kind: "error", text: summary });
            onMessage(summary);
            return;
          }
        }

        setTestStatus({
          kind: "error",
          text: "Figma sign-in is still pending. Complete authorization in your browser or try Connect Figma again."
        });
        return;
      }

      if (result.ok && result.status === "connected") {
        const refreshed = await client.listMcpServers();
        setMcpServers(refreshed.servers);
        setTestStatus({ kind: "success", text: "Figma MCP connected." });
        onMessage("Figma MCP connected.");
        return;
      }

      const summary = formatConnectionDiagnostic(result.diagnostic) ?? "Figma MCP sign-in failed.";
      setTestStatus({ kind: "error", text: summary });
      onMessage(summary);
    } catch (error) {
      const summary = error instanceof Error ? error.message : "Figma MCP sign-in failed.";
      setTestStatus({ kind: "error", text: summary });
      onMessage(summary);
    } finally {
      setBusyMcpId(null);
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

  const llmAdapters = adapters.filter((adapter) => isLlmProviderAdapterId(adapter.id));

  return (
    <Stack gap={7}>
      <Stack gap={5} orientation="horizontal" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Agents and MCP</h2>
        <Button kind="secondary" disabled={!connected} onClick={() => void refreshDetection()}>
          Refresh detection
        </Button>
      </Stack>

      <AgentTestStatusBanner status={testStatus} />

      <Stack gap={7} orientation="horizontal" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
        <Tile style={{ flex: 1, minWidth: 280 }}>
          <Stack gap={5}>
            <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}>LLM providers</h3>
            <RadioButtonGroup
              legendText="Active provider"
              name="writer-active-adapter"
              valueSelected={activeAdapterId ?? undefined}
              onChange={(value) => void selectAdapter(String(value))}
            >
              {llmAdapters.map((adapter) => {
                const label = runtimeLabel(adapter);

                return (
                  <Stack gap={3} key={adapter.id} style={{ marginBlockEnd: "var(--cds-spacing-05)" }}>
                    <RadioButton labelText={adapter.displayName} value={adapter.id} disabled={!adapter.available} />
                    <Stack gap={2} orientation="horizontal">
                      {label ? <Tag type="gray">{label}</Tag> : null}
                      <Tag type={adapter.available ? "green" : "red"}>
                        {adapter.available ? "available" : "unavailable"}
                      </Tag>
                    </Stack>
                    {adapter.setupMessage ? (
                      <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--cds-text-secondary)" }}>
                        {adapter.setupMessage}
                      </p>
                    ) : null}
                    {formatConnectionDiagnostic(adapter.diagnostic) ? (
                      <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--cds-text-secondary)" }}>
                        {formatConnectionDiagnostic(adapter.diagnostic)}
                      </p>
                    ) : null}
                    {adapter.executablePath ? (
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.75rem",
                          color: "var(--cds-text-secondary)",
                          wordBreak: "break-all"
                        }}
                      >
                        {adapter.executablePath}
                      </p>
                    ) : null}
                    <Button
                      kind="secondary"
                      size="sm"
                      disabled={!adapter.available || busyAdapterId === adapter.id}
                      onClick={() => void testConnection(adapter.id)}
                    >
                      {busyAdapterId === adapter.id ? "Testing…" : "Test connection"}
                    </Button>
                  </Stack>
                );
              })}
            </RadioButtonGroup>
          </Stack>
        </Tile>

        <Tile style={{ flex: 1, minWidth: 280 }}>
          <Stack gap={5}>
            <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}>MCP servers</h3>
            {mcpServers.map((server) => (
              <Stack gap={3} key={server.id} style={{ marginBlockEnd: "var(--cds-spacing-06)" }}>
                <Stack gap={3} orientation="horizontal" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                  <Toggle
                    id={`mcp-${server.id}`}
                    labelText={server.name}
                    labelA="Off"
                    labelB="On"
                    toggled={server.enabled}
                    onToggle={(enabled) => void toggleMcp(server.id, enabled)}
                  />
                  <Tag type={server.status === "connected" ? "green" : "red"}>{server.status}</Tag>
                </Stack>
                {formatConnectionDiagnostic(server.diagnostic) ? (
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--cds-text-secondary)" }}>
                    {formatConnectionDiagnostic(server.diagnostic)}
                  </p>
                ) : server.errorMessage ? (
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--cds-support-error)" }}>
                    {server.errorMessage}
                  </p>
                ) : null}
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--cds-text-secondary)" }}>
                  Tools: {summarizeMcpTools(server.tools)}
                </p>
                {server.id === "figma" ? (
                  <Stack gap={3} orientation="horizontal">
                    {(server.status !== "connected" || server.diagnostic?.code === "needs_auth") && (
                      <Button
                        kind="secondary"
                        size="sm"
                        disabled={!connected || busyMcpId === server.id}
                        onClick={() => void connectFigma(server.id)}
                      >
                        {busyMcpId === server.id ? "Connecting…" : "Connect Figma"}
                      </Button>
                    )}
                    <Button
                      kind="secondary"
                      size="sm"
                      disabled={!connected || busyMcpId === server.id || server.status !== "connected"}
                      onClick={() => void testFigmaRead(server.id)}
                    >
                      {busyMcpId === server.id ? "Testing…" : "Test Figma read"}
                    </Button>
                  </Stack>
                ) : null}
              </Stack>
            ))}
          </Stack>
        </Tile>
      </Stack>
    </Stack>
  );
}
