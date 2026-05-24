import { useRef, useState } from "react";
import {
  Button,
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
import {
  WriterPageGrid,
  WriterPageGridFull,
  WriterPageGridHalf,
  WriterPageStack
} from "./layout/writer-grid";
import { WriterSectionHeader } from "./layout/writer-headings";
import {
  classNames,
  fillWidth,
  hugHeight,
  hugWidth,
  row,
  rowBetween,
  rowEnd,
  surface
} from "./layout/writer-sizing";
import { useWorkspace } from "./workspace-context";

type AgentsPanelProps = {
  client: DaemonClient;
  connected: boolean;
  onMessage: (message: string) => void;
};

const adapterTileClass = (selected: boolean) =>
  classNames("writer-agent-tile", selected ? "writer-agent-tile--selected" : null);

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
    <WriterPageStack fill>
      <div className={rowBetween}>
        {agentsRefreshing ? (
          <InlineLoading description="Refreshing agent detection…" status="active" />
        ) : (
          <span />
        )}
        <Button
          kind="secondary"
          className={hugWidth}
          disabled={!connected || agentsRefreshing}
          onClick={() => void refreshAgentDetection()}
        >
          {agentsRefreshing ? "Refreshing…" : "Refresh detection"}
        </Button>
      </div>

      <AgentTestStatusBanner status={testStatus} onDismiss={() => setTestStatus(null)} />

      <WriterPageGrid gutterMode="narrow">
        <WriterPageGridHalf>
          <WriterPageStack>
            <WriterSectionHeader
              id="llm-providers-heading"
              title="LLM providers"
              description="Select the active provider for local audits and generation."
            />

            <WriterPageGrid gutterMode="wide">
              <WriterPageGridFull>
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
                      <Tile
                        key={adapter.id}
                        className={classNames(surface, fillWidth, adapterTileClass(isSelected))}
                      >
                        <Stack gap={5}>
                          <div className={rowBetween}>
                            <RadioButton
                              id={`radio-${adapter.id}`}
                              labelText={adapter.displayName}
                              value={adapter.id}
                              disabled={!canSelect}
                            />
                            <div className={classNames(row, hugHeight)}>
                              {label ? (
                                <Tag type="gray" size="sm" className={hugWidth}>
                                  {label}
                                </Tag>
                              ) : null}
                              <Tag type={status.type} size="sm" className={hugWidth}>
                                {status.label}
                              </Tag>
                            </div>
                          </div>

                          {adapter.setupMessage || adapter.executablePath || diagnosticText ? (
                            <div className="writer-agent-tile__detail">
                              {adapter.executablePath ? (
                                <div className="writer-labeled-code">
                                  <span className="writer-type-eyebrow">Executable path</span>
                                  <code className="writer-code-chip writer-break-word">
                                    {adapter.executablePath}
                                  </code>
                                </div>
                              ) : null}

                              {adapter.setupMessage ? (
                                <p className="writer-type-body-compact writer-text-secondary">
                                  {adapter.setupMessage}
                                </p>
                              ) : null}

                              {diagnosticText ? <ConnectionIssueNotice text={diagnosticText} /> : null}
                            </div>
                          ) : null}

                          <div className={classNames(rowEnd, hugHeight, "writer-agent-tile__actions")}>
                            <Button
                              kind="tertiary"
                              size="md"
                              className={hugWidth}
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
              </WriterPageGridFull>
            </WriterPageGrid>
          </WriterPageStack>
        </WriterPageGridHalf>

        <WriterPageGridHalf>
          <WriterPageStack>
            <WriterSectionHeader
              id="mcp-servers-heading"
              title="MCP servers"
              description="Turn integrations on or off and connect external tool servers (including Figma)."
            />

            <section aria-labelledby="mcp-servers-heading">
              <Stack gap={5}>
                {mcpLoadState === "loading" && mcpServers.length === 0 ? (
                  <Tile className={classNames(surface, fillWidth, "writer-mcp-tile writer-mcp-tile--centered")}>
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
                      className={classNames(surface, fillWidth, "writer-mcp-tile")}
                    >
                      <Stack gap={5}>
                        <div className={rowBetween}>
                          <Toggle
                            id={`mcp-${server.id}`}
                            labelText={server.name}
                            labelA="Off"
                            labelB="On"
                            toggled={server.enabled}
                            onToggle={(enabled) => void toggleMcp(server.id, enabled)}
                          />
                          <Tag type={statusTagType} className={hugWidth}>
                            {statusLabel}
                          </Tag>
                        </div>

                        <Stack gap={3}>
                          {diagnosticText ? <ConnectionIssueNotice text={diagnosticText} /> : null}
                          {!diagnosticText && server.errorMessage ? (
                            <ConnectionIssueNotice text={server.errorMessage} />
                          ) : null}

                          <div className="writer-labeled-code">
                            <span className="writer-type-eyebrow">Discovered tools</span>
                            {server.tools && server.tools.length > 0 ? (
                              <div className="writer-code-chip-row">
                                {server.tools.map((tool) => (
                                  <code key={tool.name} className="writer-code-chip">
                                    {tool.name}
                                  </code>
                                ))}
                              </div>
                            ) : (
                              <span className="writer-type-body-compact writer-text-secondary writer-type-italic">
                                No tools discovered
                              </span>
                            )}
                          </div>
                        </Stack>

                        {server.id === "figma" ? (
                          <div className={classNames(rowEnd, hugHeight, "writer-mcp-tile__actions")}>
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
          </WriterPageStack>
        </WriterPageGridHalf>
      </WriterPageGrid>
    </WriterPageStack>
  );
}
