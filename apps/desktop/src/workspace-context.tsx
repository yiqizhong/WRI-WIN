import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type {
  AgentAdapter,
  ChangeStatus,
  McpServer,
  ProductPackageListItem,
  SpreadsheetMappingInput,
  SpreadsheetParseResult
} from "@writer/contracts";

import {
  applyAgentAdapterList,
  LLM_PROVIDER_PLACEHOLDERS,
  MCP_SERVER_PLACEHOLDERS,
  mergeMcpServers,
  type AgentsLoadState
} from "./agents-runtime";

import { formatProductDisplayName } from "@/lib/writer-product-display";
import { checkDaemonHealth, getDaemonStatusView, type DaemonConnectionState } from "./daemon-status";
import { formatConnectionDiagnostic } from "./connection-diagnostics";
import { createDaemonClient, DaemonClientError, type DaemonClient, type ReviewQueue } from "./daemon-client";

export type WorkspaceContextValue = {
  daemonClient: DaemonClient;
  daemonState: DaemonConnectionState;
  statusView: ReturnType<typeof getDaemonStatusView>;
  daemonConnected: boolean;
  workspaceReady: boolean;
  workspaceProjectId: string | null;
  products: ProductPackageListItem[];
  selectedProductId: string | null;
  setSelectedProductId: (productId: string) => Promise<void>;
  selectedProductName: string | null;
  figmaUrl: string;
  setFigmaUrl: (value: string) => void;
  pastedText: string;
  setPastedText: (value: string) => void;
  workflowMessage: string | null;
  setWorkflowMessage: (message: string | null) => void;
  workflowRecovery: { label: string; path: string } | null;
  clearWorkflowRecovery: () => void;
  activeSessionId: string | null;
  reviewQueue: ReviewQueue | null;
  statusFilter: ChangeStatus | "all";
  setStatusFilter: (value: ChangeStatus | "all") => void;
  parsedSpreadsheet: SpreadsheetParseResult | null;
  spreadsheetMapping: SpreadsheetMappingInput | null;
  setSpreadsheetMapping: (mapping: SpreadsheetMappingInput | null) => void;
  parsedFigmaScope: string | null;
  refreshQueue: () => Promise<void>;
  runAudit: (sessionId?: string) => Promise<boolean>;
  runGuidelineGeneration: (sessionId: string) => Promise<boolean>;
  runFigmaAudit: () => Promise<boolean>;
  importSpreadsheet: () => Promise<void>;
  createSpreadsheetSession: () => Promise<void>;
  exportSpreadsheet: () => Promise<void>;
  exportSession: (format: "markdown" | "json" | "pdf") => Promise<void>;
  refreshDaemonStatus: () => Promise<boolean>;
  connectFigma: () => Promise<void>;
  startPastedTextReview: () => Promise<void>;
  llmAdapters: AgentAdapter[];
  activeAdapterId: string | null;
  agentsLoadState: AgentsLoadState;
  agentsRefreshing: boolean;
  mcpServers: McpServer[];
  mcpLoadState: AgentsLoadState;
  setActiveLlmAdapter: (adapterId: string) => Promise<void>;
  refreshAgentDetection: () => Promise<void>;
  replaceMcpServers: (servers: McpServer[]) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return value;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [daemonState, setDaemonState] = useState<DaemonConnectionState>({ kind: "checking" });
  const [workspaceProjectId, setWorkspaceProjectId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductPackageListItem[]>([]);
  const [selectedProductId, setSelectedProductIdState] = useState<string | null>(null);
  const [figmaUrl, setFigmaUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [workflowRecovery, setWorkflowRecovery] = useState<{ label: string; path: string } | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueue | null>(null);
  const [statusFilter, setStatusFilter] = useState<ChangeStatus | "all">("proposed");
  const [parsedSpreadsheet, setParsedSpreadsheet] = useState<SpreadsheetParseResult | null>(null);
  const [spreadsheetMapping, setSpreadsheetMapping] = useState<SpreadsheetMappingInput | null>(null);
  const [parsedFigmaScope, setParsedFigmaScope] = useState<string | null>(null);
  const [llmAdapters, setLlmAdapters] = useState<AgentAdapter[]>(LLM_PROVIDER_PLACEHOLDERS);
  const [activeAdapterId, setActiveAdapterId] = useState<string | null>(null);
  const [agentsLoadState, setAgentsLoadState] = useState<AgentsLoadState>("idle");
  const [agentsRefreshing, setAgentsRefreshing] = useState(false);
  const [mcpServers, setMcpServers] = useState<McpServer[]>(MCP_SERVER_PLACEHOLDERS);
  const [mcpLoadState, setMcpLoadState] = useState<AgentsLoadState>("idle");

  const statusView = useMemo(() => getDaemonStatusView(daemonState), [daemonState]);
  const daemonClient = useMemo(() => createDaemonClient(), []);
  const daemonConnected = daemonState.kind === "connected" || daemonState.kind === "degraded";
  const workspaceReady = daemonConnected && workspaceProjectId != null;

  const selectedProductName = useMemo(() => {
    if (!selectedProductId) {
      return null;
    }
    return formatProductDisplayName(selectedProductId);
  }, [products, selectedProductId]);

  const setSelectedProductId = useCallback(
    async (productId: string) => {
      setSelectedProductIdState(productId);
      if (!workspaceProjectId) {
        return;
      }

      try {
        await daemonClient.setActiveProductId(workspaceProjectId, productId);
      } catch {
        // Selection still applies to the current session; persistence is best-effort.
      }
    },
    [daemonClient, workspaceProjectId]
  );

  async function refreshQueue() {
    if (!activeSessionId) {
      return;
    }

    try {
      const queue = await daemonClient.getReviewQueue(activeSessionId);
      setReviewQueue(queue);
    } catch {
      setReviewQueue(null);
    }
  }

  async function runAudit(sessionId?: string): Promise<boolean> {
    const targetSessionId = sessionId ?? activeSessionId;
    if (!targetSessionId) {
      return false;
    }

    try {
      const result = await daemonClient.runAudit(targetSessionId);
      setReviewQueue(result);
      setWorkflowRecovery(null);

      if (result.diagnostic) {
        setWorkflowMessage(formatConnectionDiagnostic(result.diagnostic) ?? result.diagnostic.message);

        if (result.diagnostic.code === "mcp_not_ready") {
          setWorkflowRecovery({ label: "Connect Figma", path: "/agents" });
        }

        return false;
      }

      setWorkflowMessage(`Audit generated ${result.changes.length} proposed changes.`);
      return true;
    } catch (error) {
      setWorkflowRecovery(null);
      setWorkflowMessage(error instanceof DaemonClientError ? error.message : "Audit run failed.");
      return false;
    }
  }

  async function runGuidelineGeneration(sessionId: string): Promise<boolean> {
    setWorkflowMessage(null);
    setWorkflowRecovery(null);

    try {
      const result = await daemonClient.generateFigmaGuideline({
        sessionId,
        maxCandidates: 500
      });

      if (!result.ok) {
        const diagnosticMessage = result.diagnostic
          ? (formatConnectionDiagnostic(result.diagnostic) ?? result.diagnostic.message)
          : "Guideline generation failed.";
        setWorkflowMessage(diagnosticMessage);

        if (result.diagnostic?.code === "mcp_not_ready") {
          setWorkflowRecovery({ label: "Connect Figma", path: "/agents" });
        }

        return false;
      }

      return true;
    } catch (error) {
      const message =
        error instanceof DaemonClientError ? error.message : "Guideline generation failed.";

      try {
        await daemonClient.abandonFigmaGuidelineGeneration({ sessionId, message });
      } catch {
        // Best-effort: generation may have already finished on the daemon.
      }

      setWorkflowMessage(message);
      return false;
    }
  }

  async function runFigmaAudit(): Promise<boolean> {
    if (!workspaceProjectId || !figmaUrl.trim()) {
      return false;
    }

    setWorkflowMessage(null);

    try {
      const session = await daemonClient.createFigmaSession({
        mode: "single_frame",
        projectId: workspaceProjectId,
        productId: selectedProductId ?? undefined,
        featureName: "Legacy Figma audit",
        description: "Started from Settings sources tab",
        url: figmaUrl.trim()
      });
      setActiveSessionId(session.id);
      return runAudit(session.id);
    } catch (error) {
      setWorkflowMessage(error instanceof DaemonClientError ? error.message : "Could not start Figma audit.");
      return false;
    }
  }

  async function importSpreadsheet() {
    if (!workspaceProjectId) {
      return;
    }

    const filePath = await window.writerDesktop.pickSpreadsheetFile();
    if (!filePath) {
      return;
    }

    try {
      const parsed = await daemonClient.parseSpreadsheet(filePath);
      setParsedSpreadsheet(parsed);
      setSpreadsheetMapping({
        source: parsed.suggestedMapping.source ?? 0,
        suggestion: parsed.suggestedMapping.suggestion,
        status: parsed.suggestedMapping.status,
        note: parsed.suggestedMapping.note
      });
      setWorkflowMessage(
        `Parsed ${parsed.rows.length} rows from ${parsed.fileName}. Confirm mapping, then create session.`
      );
    } catch (error) {
      setWorkflowMessage(error instanceof DaemonClientError ? error.message : "Spreadsheet import failed.");
    }
  }

  async function createSpreadsheetSession() {
    if (!workspaceProjectId || !parsedSpreadsheet || !spreadsheetMapping) {
      return;
    }

    try {
      const session = await daemonClient.createSession({
        projectId: workspaceProjectId,
        productId: selectedProductId ?? undefined,
        sourceType: "spreadsheet",
        scope: {
          fileName: parsedSpreadsheet.fileName,
          format: parsedSpreadsheet.format,
          columns: parsedSpreadsheet.columns,
          rows: parsedSpreadsheet.rows,
          mapping: spreadsheetMapping
        }
      });
      setActiveSessionId(session.id);
      setWorkflowMessage(`Spreadsheet session ready (${session.id.slice(0, 8)}…).`);
    } catch (error) {
      setWorkflowMessage(error instanceof DaemonClientError ? error.message : "Could not create spreadsheet session.");
    }
  }

  async function exportSpreadsheet() {
    if (!activeSessionId || !spreadsheetMapping) {
      return;
    }

    const savePath = await window.writerDesktop.pickSaveFile({
      defaultPath: "review-export.xlsx",
      filters: [
        { name: "Excel", extensions: ["xlsx"] },
        { name: "CSV", extensions: ["csv"] }
      ]
    });

    if (!savePath) {
      return;
    }

    try {
      const result = await daemonClient.exportSpreadsheet({
        sessionId: activeSessionId,
        outputPath: savePath,
        mapping: spreadsheetMapping
      });
      setWorkflowMessage(`Exported ${result.rowCount} rows to ${result.outputPath}.`);
    } catch (error) {
      setWorkflowMessage(error instanceof DaemonClientError ? error.message : "Spreadsheet export failed.");
    }
  }

  async function exportSession(format: "markdown" | "json" | "pdf") {
    if (!activeSessionId) {
      return;
    }

    try {
      if (format === "markdown") {
        const markdown = await daemonClient.exportMarkdown(activeSessionId);
        const savePath = await window.writerDesktop.pickSaveFile({
          defaultPath: "review-report.md",
          filters: [{ name: "Markdown", extensions: ["md"] }]
        });
        if (!savePath) {
          return;
        }
        await window.writerDesktop.saveTextFile(savePath, markdown);
        setWorkflowMessage(`Markdown report saved to ${savePath}.`);
      } else if (format === "json") {
        const json = await daemonClient.exportJson(activeSessionId);
        const savePath = await window.writerDesktop.pickSaveFile({
          defaultPath: "review-report.json",
          filters: [{ name: "JSON", extensions: ["json"] }]
        });
        if (!savePath) {
          return;
        }
        await window.writerDesktop.saveTextFile(savePath, JSON.stringify(json, null, 2));
        setWorkflowMessage(`JSON report saved to ${savePath}.`);
      } else {
        const html = await daemonClient.exportHtml(activeSessionId);
        const savePath = await window.writerDesktop.pickSaveFile({
          defaultPath: "review-report.pdf",
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        });
        if (!savePath) {
          return;
        }
        await window.writerDesktop.exportPdfFromHtml(savePath, html);
        setWorkflowMessage(`PDF report saved to ${savePath}.`);
      }
    } catch (error) {
      setWorkflowMessage(error instanceof DaemonClientError ? error.message : "Export failed.");
    }
  }

  async function refreshDaemonStatus() {
    setDaemonState({ kind: "checking" });
    const state = await checkDaemonHealth();
    setDaemonState(state);
    return state.kind === "connected" || state.kind === "degraded";
  }

  async function connectFigma() {
    if (!figmaUrl.trim()) {
      return;
    }

    setWorkflowMessage(null);

    try {
      const parsed = await daemonClient.parseFigmaUrl(figmaUrl.trim());
      setParsedFigmaScope(`${parsed.suggestedScope.kind} · ${parsed.fileKey}`);
      setWorkflowMessage(`Figma scope ready: ${parsed.suggestedScope.kind} (${parsed.fileKey})`);
    } catch (error) {
      const message =
        error instanceof DaemonClientError ? error.message : "Could not parse the Figma URL.";
      setParsedFigmaScope(null);
      setWorkflowMessage(message);
    }
  }

  async function startPastedTextReview() {
    if (!workspaceProjectId || !selectedProductId || !pastedText.trim()) {
      return;
    }

    setWorkflowMessage(null);

    try {
      const session = await daemonClient.createPastedTextSession({
        projectId: workspaceProjectId,
        productId: selectedProductId,
        text: pastedText.trim()
      });
      setActiveSessionId(session.id);
      const ok = await runAudit(session.id);
      if (ok) {
        setWorkflowMessage(`Audit ready (${session.id.slice(0, 8)}…). Review proposed changes.`);
      }
    } catch (error) {
      const message =
        error instanceof DaemonClientError
          ? error.message
          : "Could not create a pasted text review session.";
      setWorkflowMessage(message);
    }
  }

  async function setActiveLlmAdapter(adapterId: string) {
    const previousAdapterId = activeAdapterId;
    setActiveAdapterId(adapterId);

    try {
      const result = await daemonClient.setActiveAdapter(adapterId);
      setLlmAdapters((current) => applyAgentAdapterList(current, result).adapters);
      setActiveAdapterId(result.activeAdapterId);
      setWorkflowMessage(`Active provider: ${result.activeAdapterId ?? adapterId}`);
    } catch (error) {
      setActiveAdapterId(previousAdapterId);
      setWorkflowMessage(
        error instanceof DaemonClientError ? error.message : "Could not set active provider."
      );
    }
  }

  async function refreshAgentDetection() {
    setAgentsRefreshing(true);
    try {
      const agentList = await daemonClient.refreshAgents();
      setLlmAdapters((current) => applyAgentAdapterList(current, agentList).adapters);
      setActiveAdapterId(agentList.activeAdapterId);
      setAgentsLoadState("ready");
      setWorkflowMessage("Agent detection refreshed.");
    } catch (error) {
      setWorkflowMessage(error instanceof DaemonClientError ? error.message : "Could not refresh agents.");
    } finally {
      setAgentsRefreshing(false);
    }
  }

  function replaceMcpServers(servers: McpServer[]) {
    setMcpServers(servers);
    setMcpLoadState("ready");
  }

  useEffect(() => {
    void refreshDaemonStatus();
  }, []);

  useEffect(() => {
    if (!daemonConnected) {
      return;
    }

    void (async () => {
      try {
        const workspace = await daemonClient.getWorkspace();
        setWorkspaceProjectId(workspace.projectId);
        setProducts(workspace.products);

        const preferred =
          workspace.lastProductId && workspace.products.some((p) => p.id === workspace.lastProductId)
            ? workspace.lastProductId
            : (workspace.products[0]?.id ?? null);
        setSelectedProductIdState(preferred);
      } catch {
        // Keep UI usable when workspace bootstrap fails.
      }
    })();
  }, [daemonClient, daemonConnected]);

  const agentsRuntimeLoadedRef = useRef(false);

  useEffect(() => {
    if (!daemonConnected) {
      agentsRuntimeLoadedRef.current = false;
      setAgentsLoadState("idle");
      setMcpLoadState("idle");
      setMcpServers(MCP_SERVER_PLACEHOLDERS);
      return;
    }

    if (agentsRuntimeLoadedRef.current) {
      return;
    }

    let cancelled = false;

    setAgentsLoadState((state) => (state === "ready" ? state : "loading"));
    setMcpLoadState((state) => (state === "ready" ? state : "loading"));

    void (async () => {
      try {
        const [agentList, mcpList] = await Promise.all([
          daemonClient.listAgents(),
          daemonClient.listMcpServers()
        ]);

        if (cancelled) {
          return;
        }

        setLlmAdapters((current) => applyAgentAdapterList(current, agentList).adapters);
        setActiveAdapterId(agentList.activeAdapterId);
        setMcpServers((current) => mergeMcpServers(current, mcpList.servers));
        setAgentsLoadState("ready");
        setMcpLoadState("ready");
        agentsRuntimeLoadedRef.current = true;
      } catch {
        if (!cancelled) {
          setMcpServers(MCP_SERVER_PLACEHOLDERS);
          setAgentsLoadState("ready");
          setMcpLoadState("ready");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [daemonClient, daemonConnected]);

  useEffect(() => {
    void refreshQueue();
  }, [activeSessionId]);

  const value: WorkspaceContextValue = {
    daemonClient,
    daemonState,
    statusView,
    daemonConnected,
    workspaceReady,
    workspaceProjectId,
    products,
    selectedProductId,
    setSelectedProductId,
    selectedProductName,
    figmaUrl,
    setFigmaUrl,
    pastedText,
    setPastedText,
    workflowMessage,
    setWorkflowMessage,
    workflowRecovery,
    clearWorkflowRecovery: () => setWorkflowRecovery(null),
    activeSessionId,
    reviewQueue,
    statusFilter,
    setStatusFilter,
    parsedSpreadsheet,
    spreadsheetMapping,
    setSpreadsheetMapping,
    parsedFigmaScope,
    refreshQueue,
    runAudit,
    runGuidelineGeneration,
    runFigmaAudit,
    importSpreadsheet,
    createSpreadsheetSession,
    exportSpreadsheet,
    exportSession,
    refreshDaemonStatus,
    connectFigma,
    startPastedTextReview,
    llmAdapters,
    activeAdapterId,
    agentsLoadState,
    agentsRefreshing,
    mcpServers,
    mcpLoadState,
    setActiveLlmAdapter,
    refreshAgentDetection,
    replaceMcpServers
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
