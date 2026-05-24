import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { AgentAdapter } from "@writer/contracts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { InlineAlert } from "@/components/writer/inline-alert";

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

function tagVariant(type: "green" | "red" | "gray"): "default" | "destructive" | "secondary" {
  if (type === "green") {
    return "default";
  }
  if (type === "red") {
    return "destructive";
  }
  return "secondary";
}

function mcpTagVariant(type: "green" | "red" | "gray"): "default" | "destructive" | "secondary" {
  return tagVariant(type);
}

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
  return <InlineAlert kind="error" title="" subtitle={text} />;
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            <span>Refreshing agent detection…</span>
          </div>
        ) : (
          <span />
        )}
        <Button
          variant="secondary"
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
              title="LLM providers"
              description="Select the active provider for local audits and generation."
            />

            <WriterPageGrid gutterMode="wide">
              <WriterPageGridFull>
                <section aria-labelledby="llm-providers-heading">
                  <fieldset className="flex flex-col gap-5">
                    <legend id="llm-providers-heading" className="sr-only">
                      Active provider
                    </legend>
                    {llmAdapters.map((adapter) => {
                      const label = runtimeLabel(adapter);
                      const status = availabilityTag(adapter, agentsLoadState, agentsRefreshing);
                      const isSelected = activeAdapterId === adapter.id;
                      const canSelect =
                        status.label !== "Loading" && (adapter.available || agentsLoadState !== "ready");
                      const diagnosticText = formatConnectionDiagnostic(adapter.diagnostic);

                      return (
                        <Card
                          key={adapter.id}
                          className={classNames(surface, fillWidth, adapterTileClass(isSelected))}
                        >
                          <CardContent className="flex flex-col gap-5 p-4">
                            <div className={rowBetween}>
                              <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  id={`radio-${adapter.id}`}
                                  name="writer-active-adapter"
                                  value={adapter.id}
                                  checked={isSelected}
                                  disabled={!canSelect}
                                  onChange={() => void setActiveLlmAdapter(adapter.id)}
                                  className="size-4 shrink-0"
                                />
                                <Label htmlFor={`radio-${adapter.id}`} className="font-medium">
                                  {adapter.displayName}
                                </Label>
                              </div>
                              <div className={classNames(row, hugHeight)}>
                                {label ? (
                                  <Badge variant="secondary" className={hugWidth}>
                                    {label}
                                  </Badge>
                                ) : null}
                                <Badge variant={tagVariant(status.type)} className={hugWidth}>
                                  {status.label}
                                </Badge>
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
                                variant="outline"
                                size="sm"
                                className={hugWidth}
                                disabled={
                                  status.label === "Loading" ||
                                  !adapter.available ||
                                  busyAdapterId === adapter.id
                                }
                                onClick={() => void testConnection(adapter.id)}
                              >
                                {busyAdapterId === adapter.id ? "Testing…" : "Test connection"}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </fieldset>
                </section>
              </WriterPageGridFull>
            </WriterPageGrid>
          </WriterPageStack>
        </WriterPageGridHalf>

        <WriterPageGridHalf>
          <WriterPageStack>
            <WriterSectionHeader
              title="MCP servers"
              description="Turn integrations on or off and connect external tool servers (including Figma)."
            />

            <section aria-labelledby="mcp-servers-heading">
              <div className="flex flex-col gap-5">
                {mcpLoadState === "loading" && mcpServers.length === 0 ? (
                  <Card className={classNames(surface, fillWidth, "writer-mcp-tile writer-mcp-tile--centered")}>
                    <CardContent className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      <span>Loading MCP servers…</span>
                    </CardContent>
                  </Card>
                ) : null}

                {mcpServers.map((server) => {
                  const diagnosticText = formatConnectionDiagnostic(server.diagnostic);
                  const statusLabel = mcpConnectionStatusLabel(server.status);
                  const statusTagType = mcpConnectionStatusTagType(server.status);

                  return (
                    <Card key={server.id} className={classNames(surface, fillWidth, "writer-mcp-tile")}>
                      <CardContent className="flex flex-col gap-5 p-4">
                        <div className={rowBetween}>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`mcp-${server.id}`}
                              checked={server.enabled}
                              onCheckedChange={(checked) => void toggleMcp(server.id, checked === true)}
                            />
                            <Label htmlFor={`mcp-${server.id}`}>{server.name}</Label>
                          </div>
                          <Badge variant={mcpTagVariant(statusTagType)} className={hugWidth}>
                            {statusLabel}
                          </Badge>
                        </div>

                        <div className="flex flex-col gap-3">
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
                        </div>

                        {server.id === "figma" ? (
                          <div className={classNames(rowEnd, hugHeight, "writer-mcp-tile__actions")}>
                            {figmaAuthPending && busyMcpId === server.id ? (
                              <Button variant="ghost" size="sm" onClick={cancelFigmaAuth}>
                                Cancel sign-in
                              </Button>
                            ) : null}
                            {(server.status !== "connected" || server.diagnostic?.code === "needs_auth") && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!connected || busyMcpId === server.id}
                                onClick={() => void connectFigma(server.id)}
                              >
                                {busyMcpId === server.id ? "Connecting…" : "Connect Figma"}
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!connected || busyMcpId === server.id || server.status !== "connected"}
                              onClick={() => void testFigmaRead(server.id)}
                            >
                              {busyMcpId === server.id && !figmaAuthPending ? "Testing…" : "Test Figma read"}
                            </Button>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          </WriterPageStack>
        </WriterPageGridHalf>
      </WriterPageGrid>
    </WriterPageStack>
  );
}
