import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCw } from "lucide-react";
import {
  type AgentAdapter,
  type LlmProviderAdapterId,
  type McpServer,
  isLlmProviderAdapterId
} from "@writer/contracts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/writer/glass-card";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";
import { WriterSwitch } from "@/components/writer/writer-switch";
import { DaemonStatusInfo } from "@/components/writer/daemon-status-info";
import { InlineAlert } from "@/components/writer/inline-alert";

import type { DaemonClient } from "./daemon-client";
import type { DaemonStatusView } from "./daemon-status";
import { SpeedBoostSection } from "./SpeedBoostSection";
import type { DraftStatus } from "./SpeedBoostSection";
import { isAdapterStatusLoading } from "./agents-runtime";
import {
  formatConnectionDiagnostic,
  mcpConnectionStatusLabel,
  mcpConnectionStatusTagType
} from "./connection-diagnostics";
import { WriterPageGrid, WriterPageGridHalf, WriterPageStack } from "./layout/writer-grid";
import { WriterSectionHeader } from "./layout/writer-headings";
import {
  classNames,
  fillWidth,
  hugHeight,
  hugWidth,
  row,
  rowBetween,
  rowEnd
} from "./layout/writer-sizing";
import { useWorkspace } from "./workspace-context";

type AgentsPanelProps = {
  client: DaemonClient;
  connected: boolean;
  statusView: DaemonStatusView;
};

const LLM_PROVIDER_LOGO: Partial<Record<LlmProviderAdapterId, string>> = {
  "cursor-agent": "/llm-provider-logos/cursor-agent.png",
  devin: "/llm-provider-logos/devin.png"
};

function llmLogoPath(adapterId: string): string | undefined {
  return isLlmProviderAdapterId(adapterId) ? LLM_PROVIDER_LOGO[adapterId] : undefined;
}

function LlmLogo({ adapter }: { adapter: AgentAdapter }) {
  const src = llmLogoPath(adapter.id);
  if (!src) {
    return null;
  }

  const isBlackLockup = adapter.id === "devin";

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      aria-hidden
      className={classNames(
        "shrink-0 object-contain",
        isBlackLockup
          ? "h-6 max-h-6 w-auto max-w-[148px] object-left brightness-0 invert opacity-95"
          : "h-6 w-6"
      )}
    />
  );
}

const FIGMA_MCP_LOGO = "/mcp-server-logos/figma.png";

function McpServerLogo({ server }: { server: McpServer }) {
  if (server.id !== "figma") {
    return null;
  }

  return (
    <img
      src={FIGMA_MCP_LOGO}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      aria-hidden
      className="h-[41px] w-[33px] shrink-0 object-contain"
    />
  );
}

function compactDaemonDetail(statusView: DaemonStatusView, connected: boolean): string {
  if (!connected) {
    return "Run npm run dev:daemon";
  }

  const match = statusView.detail.match(/Version ([^·]+)/);
  return match ? `v${match[1].trim()}` : statusView.detail;
}

function tagVariant(type: "green" | "red" | "gray"): "default" | "destructive" | "secondary" {
  if (type === "green") {
    return "default";
  }
  if (type === "red") {
    return "destructive";
  }
  return "secondary";
}

type StatusBadge = {
  type: "green" | "red" | "gray";
  label: string;
};

function adapterRowBadge(
  adapter: AgentAdapter,
  loadState: ReturnType<typeof useWorkspace>["agentsLoadState"],
  refreshing: boolean,
  daemonConnected: boolean
): StatusBadge {
  if (!daemonConnected) {
    return { type: "gray", label: "Offline" };
  }

  if (isAdapterStatusLoading(adapter, loadState, refreshing, daemonConnected)) {
    return { type: "gray", label: "Loading" };
  }

  if (!adapter.available) {
    return { type: "red", label: "Unavailable" };
  }

  if (adapter.diagnostic?.severity === "error" || adapter.authState === "needs_auth") {
    return { type: "red", label: "Not connected" };
  }

  if (adapter.diagnostic?.code === "ready") {
    return { type: "green", label: "Ready" };
  }

  return { type: "gray", label: "—" };
}

function localModelAdapterBadge(adapter: AgentAdapter, daemonConnected: boolean): StatusBadge {
  if (!daemonConnected) {
    return { type: "gray", label: "Offline" };
  }

  const code = adapter.diagnostic?.code;

  if (adapter.available) {
    return { type: "green", label: "Ready" };
  }

  if (code === "not_installed") {
    return { type: "gray", label: "Not downloaded" };
  }

  if (code === "downloading" || code === "verifying") {
    return { type: "gray", label: code === "verifying" ? "Verifying" : "Downloading" };
  }

  if (adapter.diagnostic?.severity === "error") {
    return { type: "red", label: "Failed" };
  }

  return { type: "gray", label: "Not ready" };
}

function mcpConnectionBadge(server: McpServer, signingIn: boolean): StatusBadge {
  if (signingIn) {
    return { type: "gray", label: "Connecting" };
  }

  if (!server.enabled) {
    return { type: "gray", label: "—" };
  }

  return {
    type: mcpConnectionStatusTagType(server.status),
    label: mcpConnectionStatusLabel(server.status)
  };
}

function mcpIssueText(server: McpServer): string | null {
  const diagnostic = formatConnectionDiagnostic(server.diagnostic);
  if (diagnostic && server.diagnostic?.severity === "error") {
    return diagnostic;
  }
  return server.errorMessage ?? null;
}

/** Badge only when something is wrong; toggle alone is enough when healthy. */
function mcpRowProblemBadge(
  server: McpServer,
  signingIn: boolean,
  issueText: string | null
): StatusBadge | null {
  if (!server.enabled || signingIn) {
    return null;
  }

  const conn = mcpConnectionBadge(server, false);

  if (conn.type === "red") {
    return conn;
  }

  if (issueText) {
    return { type: "red", label: "Error" };
  }

  if (server.status === "disconnected") {
    return conn;
  }

  return null;
}

function ConnectionIssueNotice({ text }: { text: string }) {
  return <InlineAlert kind="error" title="" subtitle={text} />;
}

export function AgentsPanel({ client, connected, statusView }: AgentsPanelProps) {
  const workspace = useWorkspace();
  const {
    llmAdapters,
    localModelAdapters,
    activeAdapterId,
    agentsLoadState,
    agentsRefreshing,
    mcpServers,
    daemonState,
    setActiveLlmAdapter,
    refreshDaemonStatus,
    refreshAgentDetection,
    replaceMcpServers
  } = workspace;

  const [localModelLoading, setLocalModelLoading] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>({ installed: false, enabled: false });
  const [draftInstalling, setDraftInstalling] = useState(false);

  useEffect(() => {
    if (!connected) return;
    void client.getDraftModelStatus().then(setDraftStatus).catch(() => undefined);
  }, [connected, client]);

  const panelRefreshing = daemonState.kind === "checking" || agentsRefreshing;

  const [busyMcpId, setBusyMcpId] = useState<string | null>(null);
  const [figmaAuthPending, setFigmaAuthPending] = useState(false);
  const figmaAuthCancelRef = useRef(false);
  const [refreshingAdapterId, setRefreshingAdapterId] = useState<string | null>(null);
  const [reconnectingMcpId, setReconnectingMcpId] = useState<string | null>(null);
  // uiRefreshing holds the "Connecting / Refreshing" state for at least MIN_REFRESH_MS
  // even when the backend responds instantly, so the layout change is never jarring.
  const [uiRefreshing, setUiRefreshing] = useState(false);

  const MIN_REFRESH_MS = 3_000;
  const anyRefreshing = panelRefreshing || uiRefreshing;
  // Keep every interactive element enabled while refreshing so nothing flickers to disabled.
  const stableConnected = connected || anyRefreshing;

  async function handleRefresh() {
    const start = Date.now();
    setUiRefreshing(true);
    try {
      const daemonConnected = await refreshDaemonStatus();
      if (daemonConnected) {
        await refreshAgentDetection();
      }
    } finally {
      const remaining = MIN_REFRESH_MS - (Date.now() - start);
      if (remaining > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      }
      setUiRefreshing(false);
    }
  }

  async function refreshAdapter(adapterId: string) {
    const start = Date.now();
    setRefreshingAdapterId(adapterId);
    try {
      await refreshAgentDetection();
    } finally {
      const remaining = MIN_REFRESH_MS - (Date.now() - start);
      if (remaining > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      }
      setRefreshingAdapterId(null);
    }
  }

  async function reconnectMcp(serverId: string) {
    setReconnectingMcpId(serverId);
    try {
      await client.setMcpServerEnabled(serverId, false);
      await new Promise((resolve) => setTimeout(resolve, 400));
      const result = await client.setMcpServerEnabled(serverId, true);
      replaceMcpServers(result.servers);
    } catch {
      // Refresh restores list state from the daemon.
    } finally {
      setReconnectingMcpId(null);
    }
  }

  async function toggleMcp(serverId: string, enabled: boolean) {
    try {
      const result = await client.setMcpServerEnabled(serverId, enabled);
      replaceMcpServers(result.servers);
    } catch {
      // Refresh restores list state from the daemon.
    }
  }

  function cancelFigmaAuth() {
    figmaAuthCancelRef.current = true;
    setFigmaAuthPending(false);
    setBusyMcpId(null);
  }

  async function downloadLocalModel(adapterId: string) {
    setLocalModelLoading(adapterId);
    try {
      await client.startLocalModelDownload();
      await refreshAgentDetection();
    } catch {
      // Status refreshes on next Refresh.
    } finally {
      setLocalModelLoading(null);
    }
  }

  async function resetLocalModel(adapterId: string) {
    setLocalModelLoading(adapterId);
    try {
      await client.resetLocalModel();
      await refreshAgentDetection();
    } catch {
      // Status refreshes on next Refresh.
    } finally {
      setLocalModelLoading(null);
    }
  }

  async function handleInstallDraft() {
    setDraftInstalling(true);
    setDraftStatus((prev) => ({ ...prev, lastError: undefined }));
    try {
      const result = await client.installDraftModel();
      if (result.installed) {
        setDraftStatus((prev) => ({ ...prev, installed: true, lastError: undefined }));
      } else {
        setDraftStatus((prev) => ({ ...prev, lastError: result.reason ?? "Draft model could not be installed." }));
      }
    } catch (err) {
      setDraftStatus((prev) => ({ ...prev, lastError: err instanceof Error ? err.message : "Install failed." }));
    } finally {
      setDraftInstalling(false);
    }
  }

  async function handleToggleDraft(enabled: boolean) {
    try {
      await client.setDraftModelEnabled(enabled);
      setDraftStatus((prev) => ({ ...prev, enabled }));
    } catch {
      // Toggle failure shows on next refresh.
    }
  }

  async function connectFigma(serverId: string) {
    setBusyMcpId(serverId);
    setFigmaAuthPending(true);
    figmaAuthCancelRef.current = false;

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
          if (figma?.status === "connected" || figma?.status === "error") {
            return;
          }
        }

        return;
      }

      if (result.ok && result.status === "connected") {
        const refreshed = await client.listMcpServers();
        replaceMcpServers(refreshed.servers);
        return;
      }
    } catch {
      // Server list refresh on next panel Refresh shows the failure.
    } finally {
      setFigmaAuthPending(false);
      setBusyMcpId(null);
    }
  }

  return (
    <WriterPageStack fill>
      <GlassCard className={classNames(fillWidth, "flex flex-wrap items-center justify-between gap-3 p-3")}>
        <div className="flex min-w-0 items-center gap-2">
          {anyRefreshing ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-[#e5f1ff]/70" aria-hidden />
          ) : null}
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="writer-home-text text-base font-normal leading-normal tracking-normal">
                {statusView.label}
              </p>
              <DaemonStatusInfo tooltip={statusView.infoTooltip} />
            </div>
            <span className="truncate text-xs tracking-wide text-[#e5f1ff]/60">
              {compactDaemonDetail(statusView, connected)}
            </span>
          </div>
        </div>
        <WriterPrimaryButton
          className={hugWidth}
          disabled={anyRefreshing}
          onClick={() => void handleRefresh()}
        >
          {anyRefreshing ? "Refreshing…" : "Refresh"}
        </WriterPrimaryButton>
      </GlassCard>

      <WriterPageGrid className="min-h-0 flex-1 overflow-visible grid-cols-1 auto-rows-min gap-10 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-x-14 lg:gap-y-8">
        <WriterPageGridHalf fillHeight>
          <WriterPageStack gap={3}>
            <WriterSectionHeader
              title="LLM providers"
              description="Select the model provider for content review and generation."
            />

            <fieldset className="flex min-h-0 flex-col gap-3">
              <legend className="sr-only">Active provider</legend>
              {llmAdapters.map((adapter) => {
                const isRefreshingThis = refreshingAdapterId === adapter.id || uiRefreshing;
                const status = isRefreshingThis
                  ? { type: "gray" as const, label: "Connecting" }
                  : adapterRowBadge(adapter, agentsLoadState, agentsRefreshing, stableConnected);
                const isSelected = activeAdapterId === adapter.id;
                const diagnosticText = formatConnectionDiagnostic(adapter.diagnostic);

                return (
                  <GlassCard
                    key={adapter.id}
                    selected={isSelected}
                    className="writer-agent-tile flex min-h-0 w-full flex-col gap-3 p-4"
                    onClick={
                      stableConnected ? () => void setActiveLlmAdapter(adapter.id) : undefined
                    }
                  >
                    <div className={rowBetween}>
                      <div className="flex min-w-0 items-center gap-3">
                        <input
                          type="radio"
                          id={`radio-${adapter.id}`}
                          name="writer-active-adapter"
                          value={adapter.id}
                          checked={isSelected}
                          disabled={!stableConnected}
                          onChange={() => void setActiveLlmAdapter(adapter.id)}
                          className="writer-accent-radio"
                        />
                        <LlmLogo adapter={adapter} />
                        <Label
                          htmlFor={`radio-${adapter.id}`}
                          className="writer-home-text writer-home-agent-label min-w-0 truncate font-extralight leading-snug tracking-normal"
                        >
                          {adapter.displayName}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="writer-chat-toolbar-btn"
                          aria-label="Refresh connection"
                          disabled={!stableConnected || refreshingAdapterId === adapter.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void refreshAdapter(adapter.id);
                          }}
                        >
                          <RotateCw
                            className={classNames(
                              "size-4",
                              refreshingAdapterId === adapter.id && "animate-spin"
                            )}
                          />
                        </Button>
                        <Badge variant={tagVariant(status.type)} className={hugWidth}>
                          {status.label}
                        </Badge>
                      </div>
                    </div>

                    {diagnosticText && adapter.diagnostic?.severity === "error" ? (
                      <ConnectionIssueNotice text={diagnosticText} />
                    ) : null}
                  </GlassCard>
                );
              })}
            </fieldset>
          </WriterPageStack>

          <div className="mt-8">
          <WriterPageStack gap={3}>
            <WriterSectionHeader
              title="Local models"
              description="Run inference on-device — no cloud API required."
            />

            <fieldset className="flex min-h-0 flex-col gap-3">
              <legend className="sr-only">Local model selection</legend>
              {localModelAdapters.map((adapter) => {
                const isSelected = activeAdapterId === adapter.id;
                const status = localModelAdapterBadge(adapter, stableConnected);
                const diagnosticText = formatConnectionDiagnostic(adapter.diagnostic);
                const isLoading = localModelLoading === adapter.id;
                const canSelect = stableConnected && adapter.available;

                return (
                  <GlassCard
                    key={adapter.id}
                    selected={isSelected}
                    className="writer-agent-tile flex min-h-0 w-full flex-col gap-3 p-4"
                    onClick={canSelect ? () => void setActiveLlmAdapter(adapter.id) : undefined}
                  >
                    <div className={rowBetween}>
                      <div className="flex min-w-0 items-center gap-3">
                        <input
                          type="radio"
                          id={`radio-${adapter.id}`}
                          name="writer-active-adapter"
                          value={adapter.id}
                          checked={isSelected}
                          disabled={!canSelect}
                          onChange={() => void setActiveLlmAdapter(adapter.id)}
                          className="writer-accent-radio"
                        />
                        <Label
                          htmlFor={`radio-${adapter.id}`}
                          className="writer-home-text writer-home-agent-label min-w-0 truncate font-extralight leading-snug tracking-normal"
                        >
                          {adapter.displayName}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        {isLoading ? (
                          <Loader2 className="size-4 animate-spin text-[#e5f1ff]/70" aria-hidden />
                        ) : !adapter.available ? (
                          <WriterPrimaryButton
                            className={hugWidth}
                            disabled={!stableConnected}
                            onClick={(e) => {
                              e.stopPropagation();
                              const code = adapter.diagnostic?.code;
                              if (code === "not_installed" || !code) {
                                void downloadLocalModel(adapter.id);
                              } else {
                                void resetLocalModel(adapter.id);
                              }
                            }}
                          >
                            {adapter.diagnostic?.code === "not_installed" || !adapter.diagnostic
                              ? "Download"
                              : "Retry"}
                          </WriterPrimaryButton>
                        ) : null}
                        <Badge variant={tagVariant(status.type)} className={hugWidth}>
                          {status.label}
                        </Badge>
                      </div>
                    </div>

                    {diagnosticText && adapter.diagnostic?.severity === "error" ? (
                      <ConnectionIssueNotice text={diagnosticText} />
                    ) : null}

                    {adapter.available && (
                      <SpeedBoostSection
                        status={draftStatus}
                        installing={draftInstalling}
                        onInstall={() => void handleInstallDraft()}
                        onToggle={(enabled) => void handleToggleDraft(enabled)}
                      />
                    )}
                  </GlassCard>
                );
              })}
            </fieldset>
          </WriterPageStack>
          </div>
        </WriterPageGridHalf>

        <div
          role="presentation"
          aria-hidden
          className="writer-home-divider-vertical hidden justify-self-center self-start lg:block"
        />

        <WriterPageGridHalf fillHeight>
          <WriterPageStack gap={3}>
            <WriterSectionHeader
              title="MCP"
              description="Enable tool servers to extend your agent's capabilities."
            />

            <div className="flex min-h-0 flex-col gap-5">
              {mcpServers.map((server) => {
                const issueText = mcpIssueText(server);
                const signingIn = figmaAuthPending && busyMcpId === server.id;
                const problemBadge = mcpRowProblemBadge(server, signingIn, issueText);
                const showFigmaConnect =
                  server.id === "figma" &&
                  server.enabled &&
                  (server.status !== "connected" || server.diagnostic?.code === "needs_auth");

                return (
                  <GlassCard
                    key={server.id}
                    className={classNames(
                      fillWidth,
                      "writer-mcp-tile flex min-h-[61px] w-full flex-row flex-wrap items-center justify-start gap-4 px-4 py-2.5"
                    )}
                  >
                    <div className="flex min-w-0 flex-1 basis-0 flex-row items-center gap-3">
                      <McpServerLogo server={server} />
                      <div className="flex min-w-0 flex-1 flex-row items-center justify-start gap-3">
                        <Label
                          htmlFor={`mcp-${server.id}`}
                          className="writer-home-text writer-home-agent-label min-w-0 cursor-pointer truncate font-extralight leading-snug tracking-normal"
                        >
                          {server.name}
                        </Label>
                        {server.status === "connected" && (server.tools?.length ?? 0) > 0 ? (
                          <span className="text-xs text-[#e5f1ff]/40">
                            {server.tools!.length} tools
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className={classNames(hugHeight, "flex shrink-0 flex-row items-center justify-end gap-3")}>
                      {problemBadge ? (
                        <Badge variant={tagVariant(problemBadge.type)} className={hugWidth}>
                          {problemBadge.label}
                        </Badge>
                      ) : null}
                      {server.id === "figma" && server.enabled ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="writer-chat-toolbar-btn"
                          aria-label="Reconnect Figma MCP"
                          disabled={!stableConnected || busyMcpId === server.id || reconnectingMcpId === server.id}
                          onClick={() => void reconnectMcp(server.id)}
                        >
                          <RotateCw
                            className={classNames(
                              "size-4",
                              reconnectingMcpId === server.id && "animate-spin"
                            )}
                          />
                        </Button>
                      ) : null}
                      <WriterSwitch
                        id={`mcp-${server.id}`}
                        checked={server.enabled}
                        disabled={!stableConnected || busyMcpId === server.id}
                        aria-label={`Enable ${server.name}`}
                        onCheckedChange={(checked) => void toggleMcp(server.id, checked)}
                      />
                    </div>

                    {issueText ? (
                      <div className="w-full basis-full">
                        <ConnectionIssueNotice text={issueText} />
                      </div>
                    ) : null}

                    {showFigmaConnect ? (
                      <div
                        className={classNames(
                          "w-full basis-full",
                          rowEnd,
                          hugHeight,
                          "writer-mcp-tile__actions gap-2"
                        )}
                      >
                        {signingIn ? (
                          <button
                            type="button"
                            className="cursor-pointer px-2 text-sm tracking-wide text-[#e5f1ff]/60 transition-opacity hover:text-[#e5f1ff] hover:opacity-90"
                            onClick={cancelFigmaAuth}
                          >
                            Cancel sign-in
                          </button>
                        ) : null}
                        <WriterPrimaryButton
                          className={hugWidth}
                          disabled={!stableConnected || busyMcpId === server.id}
                          onClick={() => void connectFigma(server.id)}
                        >
                          {busyMcpId === server.id ? "Connecting…" : "Connect"}
                        </WriterPrimaryButton>
                      </div>
                    ) : null}
                  </GlassCard>
                );
              })}
            </div>
          </WriterPageStack>
        </WriterPageGridHalf>
      </WriterPageGrid>
    </WriterPageStack>
  );
}
