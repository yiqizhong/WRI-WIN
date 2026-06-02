import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCw } from "lucide-react";
import {
  type AgentAdapter,
  type DevinReasoningPreference,
  type LlmProviderAdapterId,
  type McpServer,
  isLlmProviderAdapterId
} from "@writer/contracts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/writer/glass-card";
import {
  WriterFormField,
  WriterFormInput,
  WriterFormSelect,
  WriterFormStaticValue
} from "@/components/writer/writer-form-field";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";
import { WriterSwitch } from "@/components/writer/writer-switch";
import { DaemonStatusInfo } from "@/components/writer/daemon-status-info";
import { InlineAlert } from "@/components/writer/inline-alert";

import type { DaemonClient } from "./daemon-client";
import type { DaemonStatusView } from "./daemon-status";
import {
  DEVIN_DEFAULT_MODEL_ID,
  DEVIN_MODEL_SELECTOR_TEMPORARILY_DISABLED,
  resolveDevinModelLabel,
  resolveDevinModelOptions
} from "./devin-model-options";
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

const DEMO_TOTAL = 8_589_934_592; // 8 GB

function DownloadProgressDemo() {
  const [phase, setPhase] = useState<"idle" | "downloading">("idle");
  const [downloaded, setDownloaded] = useState(0);

  useEffect(() => {
    if (phase !== "downloading") return;
    setDownloaded(0);
    const step = DEMO_TOTAL / 80;
    const id = setInterval(() => {
      setDownloaded((prev) => {
        const next = prev + step;
        if (next >= DEMO_TOTAL) {
          clearInterval(id);
          setTimeout(() => { setPhase("idle"); setDownloaded(0); }, 800);
          return DEMO_TOTAL;
        }
        return next;
      });
    }, 200);
    return () => clearInterval(id);
  }, [phase]);

  const pct = Math.round((downloaded / DEMO_TOTAL) * 100);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium tracking-wide text-[#e5f1ff]/40 uppercase">
        Download progress — demo
      </p>
      <GlassCard className="flex min-h-0 w-full flex-col gap-3 p-4">
        <div className={rowBetween}>
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/local-model-logos/gemma.png"
              alt=""
              aria-hidden
              draggable={false}
              className="size-6 shrink-0 object-contain"
            />
            <Label className="writer-home-text writer-home-agent-label min-w-0 truncate font-extralight leading-snug tracking-normal">
              Gemma 4 E4B
            </Label>
            <span className="shrink-0 text-xs text-[#e5f1ff]/40">
              {formatBytes(DEMO_TOTAL)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {phase === "idle" ? (
              <WriterPrimaryButton
                className={hugWidth}
                onClick={() => setPhase("downloading")}
              >
                Download
              </WriterPrimaryButton>
            ) : (
              <Badge variant="secondary" className={hugWidth}>
                Downloading
              </Badge>
            )}
          </div>
        </div>

        {phase === "downloading" && (
          <div className="flex flex-col gap-1.5">
            <div className="flex w-full items-center gap-1">
              <div
                className="h-[3.8px] min-w-px rounded-[0.95px] bg-[linear-gradient(to_right,#3b4df2,#bafde6_94.712%,white)] transition-[flex] duration-200 ease-linear"
                style={{ flex: pct }}
              />
              <div
                className="h-[3.8px] min-w-px rounded-[0.95px] bg-[#666] transition-[flex] duration-200 ease-linear"
                style={{ flex: 100 - pct }}
              />
            </div>
            <span className="text-xs text-[#e5f1ff]/50">
              {formatBytes(downloaded)} / {formatBytes(DEMO_TOTAL)}
            </span>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const gb = bytes / 1_073_741_824;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1_048_576;
  return `${mb.toFixed(0)} MB`;
}


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
  const [localModelSizeBytes, setLocalModelSizeBytes] = useState<number | null>(null);
  const [localModelBlockedReason, setLocalModelBlockedReason] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) return;
    void client.getLocalModelStatus()
      .then((s) => {
        setLocalModelSizeBytes(s.manifest.fileSizeBytes);
        setLocalModelBlockedReason(s.blockedReason ?? null);
      })
      .catch(() => undefined);
  }, [connected, client]);
  const [downloadProgress, setDownloadProgress] = useState<{
    adapterId: string;
    downloaded: number;
    total: number;
  } | null>(null);
  const downloadPollingActiveRef = useRef(false);
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

  const [devinModelId, setDevinModelId] = useState("");
  const [devinReasoning, setDevinReasoning] = useState<DevinReasoningPreference>("medium");
  const [devinModelOptions, setDevinModelOptions] = useState<string[]>([]);
  const [devinModelLabels, setDevinModelLabels] = useState<Record<string, string>>({});
  const [devinReasoningOptions, setDevinReasoningOptions] = useState<DevinReasoningPreference[]>([]);
  const [devinSettingsBusy, setDevinSettingsBusy] = useState(false);

  async function loadDevinProviderState() {
    if (!connected) {
      return;
    }
    try {
      const settings = await client.getDevinProviderSettings();
      const options = await client.getDevinProviderOptions();
      setDevinModelId(settings.modelId);
      setDevinReasoning(settings.reasoningPreference);
      setDevinModelOptions(resolveDevinModelOptions(options.modelOptions));
      setDevinModelLabels(options.modelLabels);
      setDevinReasoningOptions(options.reasoningOptions);
    } catch {
      // best-effort load
    }
  }

  useEffect(() => {
    void loadDevinProviderState();
  }, [client, connected]);

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
      await loadDevinProviderState();
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
    } catch {
      setLocalModelLoading(null);
      return;
    }
    setLocalModelLoading(null);

    // Poll progress until the daemon reports a terminal state.
    downloadPollingActiveRef.current = true;
    while (downloadPollingActiveRef.current) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1500));
      if (!downloadPollingActiveRef.current) break;
      try {
        const status = await client.getLocalModelStatus();
        if (status.state.status === "downloading") {
          setDownloadProgress({
            adapterId,
            downloaded: status.state.downloadedBytes,
            total: status.state.totalBytes
          });
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    downloadPollingActiveRef.current = false;
    setDownloadProgress(null);
    await refreshAgentDetection();
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

  async function saveDevinSettings(next?: { modelId?: string; reasoningPreference?: DevinReasoningPreference }) {
    if (!connected) {
      return;
    }
    setDevinSettingsBusy(true);
    try {
      const updated = await client.updateDevinProviderSettings({
        modelId: next?.modelId ?? devinModelId,
        reasoningPreference: next?.reasoningPreference ?? devinReasoning
      });
      setDevinModelId(updated.modelId);
      setDevinReasoning(updated.reasoningPreference);
    } finally {
      setDevinSettingsBusy(false);
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

                    {adapter.id === "devin" ? (
                      <div className="grid w-full grid-cols-1 gap-3 pt-1 md:grid-cols-2">
                        <WriterFormField label="Model">
                          {devinModelOptions.length > 0 ? (
                            <WriterFormSelect
                              value={devinModelId || DEVIN_DEFAULT_MODEL_ID}
                              disabled={
                                !connected ||
                                devinSettingsBusy ||
                                DEVIN_MODEL_SELECTOR_TEMPORARILY_DISABLED
                              }
                              displayValue={resolveDevinModelLabel(
                                devinModelId || DEVIN_DEFAULT_MODEL_ID,
                                devinModelLabels
                              )}
                              options={devinModelOptions.map((model) => ({
                                value: model,
                                label: resolveDevinModelLabel(model, devinModelLabels)
                              }))}
                              onValueChange={(value) => {
                                setDevinModelId(value);
                                void (async () => {
                                  await saveDevinSettings({ modelId: value });
                                  await loadDevinProviderState();
                                })();
                              }}
                            />
                          ) : (
                            <WriterFormInput
                              value={devinModelId || DEVIN_DEFAULT_MODEL_ID}
                              disabled={
                                !connected ||
                                devinSettingsBusy ||
                                DEVIN_MODEL_SELECTOR_TEMPORARILY_DISABLED
                              }
                              onChange={(event) => setDevinModelId(event.target.value)}
                              onBlur={() => void saveDevinSettings()}
                              placeholder="swe-1.6"
                            />
                          )}
                        </WriterFormField>
                        <WriterFormField label="Reasoning level">
                          {devinReasoningOptions.length > 0 ? (
                            <WriterFormSelect
                              value={devinReasoning}
                              disabled={!connected || devinSettingsBusy}
                              displayValue={devinReasoning}
                              options={devinReasoningOptions.map((option) => ({
                                value: option,
                                label: option
                              }))}
                              onValueChange={(value) => {
                                const preference = value as DevinReasoningPreference;
                                setDevinReasoning(preference);
                                void saveDevinSettings({ reasoningPreference: preference });
                              }}
                            />
                          ) : (
                            <WriterFormStaticValue>Not supported for this model</WriterFormStaticValue>
                          )}
                        </WriterFormField>
                      </div>
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
                        {adapter.id === "local-gemma" && (
                          <img
                            src="/local-model-logos/gemma.png"
                            alt=""
                            aria-hidden
                            draggable={false}
                            className="size-6 shrink-0 object-contain"
                          />
                        )}
                        <Label
                          htmlFor={`radio-${adapter.id}`}
                          className="writer-home-text writer-home-agent-label min-w-0 truncate font-extralight leading-snug tracking-normal"
                        >
                          {adapter.displayName}
                        </Label>
                        {localModelSizeBytes ? (
                          <span className="shrink-0 text-xs text-[#e5f1ff]/40">
                            {formatBytes(localModelSizeBytes)}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {isLoading ? (
                          <Loader2 className="size-4 animate-spin text-[#e5f1ff]/70" aria-hidden />
                        ) : !adapter.available ? (
                          localModelBlockedReason && adapter.id === "local-gemma" ? (
                            <span className="text-xs text-[#e5f1ff]/50">{localModelBlockedReason}</span>
                          ) : (
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
                          )
                        ) : null}
                        <Badge variant={tagVariant(status.type)} className={hugWidth}>
                          {status.label}
                        </Badge>
                      </div>
                    </div>

                    {downloadProgress?.adapterId === adapter.id ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex w-full items-center gap-1">
                          {(() => {
                            const pct = downloadProgress.total > 0
                              ? Math.min(100, Math.round((downloadProgress.downloaded / downloadProgress.total) * 100))
                              : 0;
                            return (
                              <>
                                <div
                                  className="h-[3.8px] min-w-px rounded-[0.95px] bg-[linear-gradient(to_right,#3b4df2,#bafde6_94.712%,white)] transition-[flex] duration-500 ease-linear"
                                  style={{ flex: pct }}
                                />
                                <div
                                  className="h-[3.8px] min-w-px rounded-[0.95px] bg-[#666] transition-[flex] duration-500 ease-linear"
                                  style={{ flex: 100 - pct }}
                                />
                              </>
                            );
                          })()}
                        </div>
                        <span className="text-xs text-[#e5f1ff]/50">
                          {formatBytes(downloadProgress.downloaded)} / {formatBytes(downloadProgress.total)}
                        </span>
                      </div>
                    ) : diagnosticText && adapter.diagnostic?.severity === "error" ? (
                      <ConnectionIssueNotice text={diagnosticText} />
                    ) : null}

                  </GlassCard>
                );
              })}
            </fieldset>

            {/* DEMO — remove once real download progress is validated */}
            <DownloadProgressDemo />

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
                      "writer-mcp-tile flex min-h-0 w-full flex-col gap-3 p-4"
                    )}
                  >
                    <div className={rowBetween}>
                      <div className="flex min-w-0 items-center gap-3">
                        <McpServerLogo server={server} />
                        <div className="flex min-w-0 items-center gap-3">
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
                      <div className="flex shrink-0 items-center gap-3">
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
                    </div>

                    {issueText ? (
                      <ConnectionIssueNotice text={issueText} />
                    ) : null}

                    {showFigmaConnect ? (
                      <div
                        className={classNames(
                          rowEnd,
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
