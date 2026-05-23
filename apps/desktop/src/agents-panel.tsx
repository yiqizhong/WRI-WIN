import { useRef, useState } from "react";
import {
  Button,
  Column,
  Grid,
  InlineLoading,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Stack,
  Tag,
  Tile,
  Toggle
} from "@carbon/react";
import type { AgentAdapter } from "@writer/contracts";

import type { DaemonClient } from "./daemon-client";
import { isAdapterStatusLoading } from "./agents-runtime";
import { AgentTestStatusBanner, type AgentTestStatus } from "./agent-test-status";
import {
  formatConnectionDiagnostic,
  mcpConnectionStatusLabel,
  mcpConnectionStatusTagType
} from "./connection-diagnostics";
import { useWorkspace } from "./workspace-context";

type AgentsPanelProps = {
  client: DaemonClient;
  connected: boolean;
  onMessage: (message: string) => void;
};

const adapterTileStyle = (selected: boolean) => ({
  border: selected ? "1px solid var(--cds-focus)" : "1px solid var(--cds-border-subtle)",
  background: selected ? "var(--cds-layer-selected)" : "var(--cds-layer-01)",
  padding: "var(--cds-spacing-05)",
  transition: "border-color 150ms ease, background-color 150ms ease",
  borderRadius: "4px"
});

function runtimeLabel(adapter: AgentAdapter): string | null {
  if (adapter.runtimeKind === "hybrid") {
    return "Cloud-backed";
  }

  if (adapter.runtimeKind === "local") {
    return "Local CLI";
  }

  return null;
}

function availabilityTag(
  adapter: AgentAdapter,
  loadState: ReturnType<typeof useWorkspace>["agentsLoadState"],
  refreshing: boolean
) {
  if (isAdapterStatusLoading(adapter, loadState, refreshing)) {
    return { type: "gray" as const, label: "Loading" };
  }

  return adapter.available
    ? { type: "green" as const, label: "Available" }
    : { type: "red" as const, label: "Unavailable" };
}

function ConnectionIssueNotice({ text }: { text: string }) {
  return (
    <InlineNotification
      kind="error"
      lowContrast
      hideCloseButton
      role="alert"
      subtitle={text}
      title=""
    />
  );
}

export function AgentsPanel({ client, connected, onMessage }: AgentsPanelProps) {
  const workspace = useWorkspace();
  const {
    llmAdapters,
    activeAdapterId,
    agentsLoadState,
    agentsRefreshing,
    mcpServers,
    mcpLoadState,
    setActiveLlmAdapter,
    refreshAgentDetection,
    replaceMcpServers
  } = workspace;

  const [busyAdapterId, setBusyAdapterId] = useState<string | null>(null);
  const [busyMcpId, setBusyMcpId] = useState<string | null>(null);
  const [figmaAuthPending, setFigmaAuthPending] = useState(false);
  const [testStatus, setTestStatus] = useState<AgentTestStatus | null>(null);
  const figmaAuthCancelRef = useRef(false);

  function adapterDisplayName(adapterId: string): string {
    return llmAdapters.find((adapter) => adapter.id === adapterId)?.displayName ?? adapterId;
  }

  async function testConnection(adapterId: string) {
    const name = adapterDisplayName(adapterId);
    setBusyAdapterId(adapterId);
    setTestStatus({
      kind: "info",
      text: `Testing ${name}… CLI agents may take up to 45 seconds.`
    });

    try {
      const result = await client.smokeAgent(adapterId);
      if (result.ok) {
        const summary = `${name} connection OK${result.output ? `: ${result.output.slice(0, 120)}` : ""}.`;
        setTestStatus({ kind: "success", text: summary });
        onMessage(summary);
      } else {
        const diagnostic = formatConnectionDiagnostic(result.diagnostic);
        const summary = diagnostic ?? result.message ?? `${name} smoke test failed.`;
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
      replaceMcpServers(result.servers);
      onMessage(`${serverId} ${enabled ? "enabled" : "disabled"}.`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not update MCP server.");
    }
  }

  function cancelFigmaAuth() {
    figmaAuthCancelRef.current = true;
    setFigmaAuthPending(false);
    setBusyMcpId(null);
    setTestStatus({ kind: "info", text: "Figma sign-in cancelled." });
  }

  async function connectFigma(serverId: string) {
    setBusyMcpId(serverId);
    setFigmaAuthPending(true);
    figmaAuthCancelRef.current = false;
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
          if (figmaAuthCancelRef.current) {
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 2_000));

          if (figmaAuthCancelRef.current) {
            return;
          }

          const refreshed = await client.listMcpServers();
          replaceMcpServers(refreshed.servers);
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
        replaceMcpServers(refreshed.servers);
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
      setFigmaAuthPending(false);
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

  return (
    <Stack gap={7}>
      <Stack gap={5} orientation="horizontal" style={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
        <Stack gap={2}>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--cds-text-secondary)", maxWidth: "42rem" }}>
            Choose an LLM provider and manage MCP integrations for local audits and Figma writeback.
          </p>
          {agentsRefreshing ? (
            <InlineLoading description="Refreshing agent detection…" status="active" />
          ) : null}
        </Stack>
        <Button
          kind="secondary"
          disabled={!connected || agentsRefreshing}
          onClick={() => void refreshAgentDetection()}
        >
          {agentsRefreshing ? "Refreshing…" : "Refresh detection"}
        </Button>
      </Stack>

      <AgentTestStatusBanner status={testStatus} onDismiss={() => setTestStatus(null)} />

      <Grid style={{ paddingLeft: 0, paddingRight: 0, margin: 0, maxWidth: "100%" }}>
        <Column sm={4} md={8} lg={8} style={{ paddingLeft: 0, paddingRight: "var(--cds-spacing-05)" }}>
          <Stack gap={5}>
            <header>
              <h2 id="llm-providers-heading" style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
                LLM Providers
              </h2>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--cds-text-secondary)", marginBlockStart: "var(--cds-spacing-01)" }}>
                Select the active provider for local audits and generation.
              </p>
            </header>

            <section aria-labelledby="llm-providers-heading">
              <RadioButtonGroup
                legendText="Active provider"
                name="writer-active-adapter"
                orientation="vertical"
                valueSelected={activeAdapterId ?? undefined}
                onChange={(value) => void setActiveLlmAdapter(String(value))}
              >
                <Stack gap={5}>
                  {llmAdapters.map((adapter) => {
                    const label = runtimeLabel(adapter);
                    const status = availabilityTag(adapter, agentsLoadState, agentsRefreshing);
                    const isSelected = activeAdapterId === adapter.id;
                    const canSelect =
                      status.label !== "Loading" && (adapter.available || agentsLoadState !== "ready");
                    const diagnosticText = formatConnectionDiagnostic(adapter.diagnostic);

                    return (
                      <Tile key={adapter.id} style={adapterTileStyle(isSelected)}>
                        <Stack gap={4}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: "var(--cds-spacing-04)"
                            }}
                          >
                            <RadioButton
                              id={`radio-${adapter.id}`}
                              labelText={adapter.displayName}
                              value={adapter.id}
                              disabled={!canSelect}
                            />
                            <div
                              style={{
                                display: "flex",
                                gap: "var(--cds-spacing-02)",
                                flexWrap: "wrap",
                                alignItems: "center"
                              }}
                            >
                              {label ? (
                                <Tag type="gray" size="sm" style={{ margin: 0 }}>
                                  {label}
                                </Tag>
                              ) : null}
                              <Tag type={status.type} size="sm" style={{ margin: 0 }}>
                                {status.label}
                              </Tag>
                            </div>
                          </div>

                          {adapter.setupMessage || adapter.executablePath || diagnosticText ? (
                            <Stack gap={3} style={{ paddingLeft: "var(--cds-spacing-06)" }}>
                              {adapter.executablePath ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "var(--cds-spacing-01)" }}>
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "var(--cds-text-secondary)",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.5px",
                                      fontWeight: 500
                                    }}
                                  >
                                    Executable path
                                  </span>
                                  <code
                                    style={{
                                      fontSize: "0.75rem",
                                      fontFamily: "var(--cds-font-family-mono, monospace)",
                                      color: "var(--cds-text-secondary)",
                                      wordBreak: "break-all",
                                      background: "var(--cds-field-01)",
                                      padding: "var(--cds-spacing-01) var(--cds-spacing-02)",
                                      borderRadius: "2px",
                                      border: "1px solid var(--cds-border-subtle)"
                                    }}
                                  >
                                    {adapter.executablePath}
                                  </code>
                                </div>
                              ) : null}

                              {adapter.setupMessage ? (
                                <p
                                  style={{
                                    margin: 0,
                                    fontSize: "0.875rem",
                                    color: "var(--cds-text-secondary)",
                                    lineHeight: 1.4
                                  }}
                                >
                                  {adapter.setupMessage}
                                </p>
                              ) : null}

                              {diagnosticText ? <ConnectionIssueNotice text={diagnosticText} /> : null}
                            </Stack>
                          ) : null}

                          <div style={{ display: "flex", justifyContent: "flex-end", paddingLeft: "var(--cds-spacing-06)" }}>
                            <Button
                              kind="tertiary"
                              size="md"
                              disabled={
                                status.label === "Loading" || !adapter.available || busyAdapterId === adapter.id
                              }
                              onClick={() => void testConnection(adapter.id)}
                            >
                              {busyAdapterId === adapter.id ? "Testing…" : "Test connection"}
                            </Button>
                          </div>
                        </Stack>
                      </Tile>
                    );
                  })}
                </Stack>
              </RadioButtonGroup>
            </section>
          </Stack>
        </Column>

        <Column sm={4} md={8} lg={8} style={{ paddingRight: 0, paddingLeft: "var(--cds-spacing-05)" }}>
          <Stack gap={5}>
            <header>
              <h2 id="mcp-servers-heading" style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
                MCP Servers
              </h2>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--cds-text-secondary)", marginBlockStart: "var(--cds-spacing-01)" }}>
                Turn integrations on or off and connect external tool servers (including Figma).
              </p>
            </header>

            <section aria-labelledby="mcp-servers-heading">
              <Stack gap={5}>
                {mcpLoadState === "loading" && mcpServers.length === 0 ? (
                  <Tile style={{ padding: "var(--cds-spacing-05)", textAlign: "center", borderRadius: "4px" }}>
                    <InlineLoading description="Loading MCP servers…" status="active" />
                  </Tile>
                ) : null}

                {mcpServers.map((server) => {
                  const diagnosticText = formatConnectionDiagnostic(server.diagnostic);
                  const statusLabel = mcpConnectionStatusLabel(server.status);
                  const statusTagType = mcpConnectionStatusTagType(server.status);

                  return (
                    <Tile
                      key={server.id}
                      style={{
                        border: "1px solid var(--cds-border-subtle)",
                        background: "var(--cds-layer-01)",
                        padding: "var(--cds-spacing-05)",
                        borderRadius: "4px"
                      }}
                    >
                      <Stack gap={4}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "var(--cds-spacing-04)"
                          }}
                        >
                          <Toggle
                            id={`mcp-${server.id}`}
                            labelText={server.name}
                            labelA="Off"
                            labelB="On"
                            toggled={server.enabled}
                            onToggle={(enabled) => void toggleMcp(server.id, enabled)}
                          />
                          <Tag type={statusTagType}>{statusLabel}</Tag>
                        </div>

                        <Stack gap={3}>
                          {diagnosticText ? <ConnectionIssueNotice text={diagnosticText} /> : null}
                          {!diagnosticText && server.errorMessage ? (
                            <ConnectionIssueNotice text={server.errorMessage} />
                          ) : null}

                          <div style={{ display: "flex", flexDirection: "column", gap: "var(--cds-spacing-02)" }}>
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--cds-text-secondary)",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                fontWeight: 500
                              }}
                            >
                              Discovered tools
                            </span>
                            {server.tools && server.tools.length > 0 ? (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--cds-spacing-02)" }}>
                                {server.tools.map((tool) => (
                                  <code
                                    key={tool.name}
                                    style={{
                                      fontSize: "0.75rem",
                                      padding: "2px 6px",
                                      background: "var(--cds-field-01)",
                                      border: "1px solid var(--cds-border-subtle)",
                                      borderRadius: "2px",
                                      fontFamily: "var(--cds-font-family-mono, monospace)",
                                      color: "var(--cds-text-secondary)"
                                    }}
                                  >
                                    {tool.name}
                                  </code>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: "0.875rem", color: "var(--cds-text-secondary)", fontStyle: "italic" }}>
                                No tools discovered
                              </span>
                            )}
                          </div>
                        </Stack>

                        {server.id === "figma" ? (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "flex-end",
                              flexWrap: "wrap",
                              gap: "var(--cds-spacing-03)",
                              paddingBlockStart: "var(--cds-spacing-02)"
                            }}
                          >
                            {figmaAuthPending && busyMcpId === server.id ? (
                              <Button kind="ghost" size="md" onClick={cancelFigmaAuth}>
                                Cancel sign-in
                              </Button>
                            ) : null}
                            {(server.status !== "connected" || server.diagnostic?.code === "needs_auth") && (
                              <Button
                                kind="tertiary"
                                size="md"
                                disabled={!connected || busyMcpId === server.id}
                                onClick={() => void connectFigma(server.id)}
                              >
                                {busyMcpId === server.id ? "Connecting…" : "Connect Figma"}
                              </Button>
                            )}
                            <Button
                              kind="tertiary"
                              size="md"
                              disabled={!connected || busyMcpId === server.id || server.status !== "connected"}
                              onClick={() => void testFigmaRead(server.id)}
                            >
                              {busyMcpId === server.id && !figmaAuthPending ? "Testing…" : "Test Figma read"}
                            </Button>
                          </div>
                        ) : null}
                      </Stack>
                    </Tile>
                  );
                })}
              </Stack>
            </section>
          </Stack>
        </Column>
      </Grid>
    </Stack>
  );
}
