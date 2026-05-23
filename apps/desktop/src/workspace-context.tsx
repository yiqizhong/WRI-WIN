import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { ChangeStatus, Project, SpreadsheetMappingInput, SpreadsheetParseResult, AgentAdapter, McpServer } from "@writer/contracts";

import {
  applyAgentAdapterList,
  LLM_PROVIDER_PLACEHOLDERS,
  type AgentsLoadState
} from "./agents-runtime";

import { checkDaemonHealth, getDaemonStatusView, type DaemonConnectionState } from "./daemon-status";
import { createDaemonClient, DaemonClientError, type DaemonClient, type ReviewQueue } from "./daemon-client";

export type WorkspaceContextValue = {
  daemonClient: DaemonClient;
  daemonState: DaemonConnectionState;
  statusView: ReturnType<typeof getDaemonStatusView>;
  daemonConnected: boolean;
  activeProject: Project | null;
  projectError: string | null;
  clearProjectError: () => void;
  isOpeningProject: boolean;
  figmaUrl: string;
  setFigmaUrl: (value: string) => void;
  pastedText: string;
  setPastedText: (value: string) => void;
  workflowMessage: string | null;
  setWorkflowMessage: (message: string | null) => void;
  activeSessionId: string | null;
  reviewQueue: ReviewQueue | null;
  statusFilter: ChangeStatus | "all";
  setStatusFilter: (value: ChangeStatus | "all") => void;
  brandVoice: string;
  setBrandVoice: (value: string) => void;
  parsedSpreadsheet: SpreadsheetParseResult | null;
  spreadsheetMapping: SpreadsheetMappingInput | null;
  setSpreadsheetMapping: (mapping: SpreadsheetMappingInput | null) => void;
  parsedFigmaScope: string | null;
  refreshQueue: () => Promise<void>;
  runAudit: () => Promise<void>;
  saveBrandVoice: () => Promise<void>;
  importSpreadsheet: () => Promise<void>;
  createSpreadsheetSession: () => Promise<void>;
  exportSpreadsheet: () => Promise<void>;
  exportSession: (format: "markdown" | "json" | "pdf") => Promise<void>;
  refreshDaemonStatus: () => Promise<void>;
  connectFigma: () => Promise<void>;
  startFigmaSession: () => Promise<void>;
  startPastedTextReview: () => Promise<void>;
  openProject: () => Promise<void>;
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
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  const [figmaUrl, setFigmaUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueue | null>(null);
  const [statusFilter, setStatusFilter] = useState<ChangeStatus | "all">("proposed");
  const [brandVoice, setBrandVoice] = useState("");
  const [parsedSpreadsheet, setParsedSpreadsheet] = useState<SpreadsheetParseResult | null>(null);
  const [spreadsheetMapping, setSpreadsheetMapping] = useState<SpreadsheetMappingInput | null>(null);
  const [parsedFigmaScope, setParsedFigmaScope] = useState<string | null>(null);
  const [llmAdapters, setLlmAdapters] = useState<AgentAdapter[]>(LLM_PROVIDER_PLACEHOLDERS);
  const [activeAdapterId, setActiveAdapterId] = useState<string | null>(null);
  const [agentsLoadState, setAgentsLoadState] = useState<AgentsLoadState>("idle");
  const [agentsRefreshing, setAgentsRefreshing] = useState(false);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [mcpLoadState, setMcpLoadState] = useState<AgentsLoadState>("idle");

  const statusView = useMemo(() => getDaemonStatusView(daemonState), [daemonState]);
  const daemonClient = useMemo(() => createDaemonClient(), []);
  const daemonConnected = daemonState.kind === "connected" || daemonState.kind === "degraded";

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

  async function runAudit() {
    if (!activeSessionId) {
      return;
    }

    try {
      const result = await daemonClient.runAudit(activeSessionId);
      setReviewQueue(result);
      setWorkflowMessage(`Audit generated ${result.changes.length} proposed changes.`);
    } catch (error) {
      setWorkflowMessage(error instanceof DaemonClientError ? error.message : "Audit run failed.");
    }
  }

  async function saveBrandVoice() {
    if (!activeProject) {
      return;
    }

    try {
      const project = await daemonClient.updateProjectGuidance({
        projectId: activeProject.id,
        brandVoice: brandVoice.trim() || undefined
      });
      setActiveProject(project);
      setWorkflowMessage("Brand voice saved for this project.");
    } catch (error) {
      setWorkflowMessage(error instanceof DaemonClientError ? error.message : "Could not save brand voice.");
    }
  }

  async function importSpreadsheet() {
    if (!activeProject) {
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
    if (!activeProject || !parsedSpreadsheet || !spreadsheetMapping) {
      return;
    }

    try {
      const session = await daemonClient.createSession({
        projectId: activeProject.id,
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
    setDaemonState(await checkDaemonHealth());
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

  async function startFigmaSession() {
    if (!activeProject || !figmaUrl.trim()) {
      return;
    }

    try {
      const session = await daemonClient.createFigmaSession({
        projectId: activeProject.id,
        url: figmaUrl.trim()
      });
      setActiveSessionId(session.id);
      setWorkflowMessage(`Figma session created (${session.id.slice(0, 8)}…).`);
    } catch (error) {
      setWorkflowMessage(error instanceof DaemonClientError ? error.message : "Could not create Figma session.");
    }
  }

  async function startPastedTextReview() {
    if (!activeProject || !pastedText.trim()) {
      return;
    }

    setWorkflowMessage(null);

    try {
      const session = await daemonClient.createPastedTextSession({
        projectId: activeProject.id,
        text: pastedText.trim()
      });
      setActiveSessionId(session.id);
      setWorkflowMessage(
        `Pasted text session created (${session.id.slice(0, 8)}…). Run audit to populate the queue.`
      );
    } catch (error) {
      const message =
        error instanceof DaemonClientError
          ? error.message
          : "Could not create a pasted text review session.";
      setWorkflowMessage(message);
    }
  }

  async function openProject() {
    setProjectError(null);
    setIsOpeningProject(true);

    try {
      const folderPath = await window.writerDesktop.pickProjectFolder();
      if (!folderPath) {
        return;
      }

      const folderName = folderPath.split(/[/\\]/).filter(Boolean).pop() ?? "Project";
      const project = await daemonClient.openProject({
        name: folderName,
        rootPath: folderPath
      });

      await daemonClient.listDirectory(project.rootPath);
      setActiveProject(project);
      setBrandVoice(project.brandVoice ?? "");
    } catch (error) {
      const message =
        error instanceof DaemonClientError
          ? error.message
          : "Could not open the project through the local daemon.";
      setProjectError(message);
    } finally {
      setIsOpeningProject(false);
    }
  }

  async function setActiveLlmAdapter(adapterId: string) {
    const result = await daemonClient.setActiveAdapter(adapterId);
    setLlmAdapters((current) => applyAgentAdapterList(current, result).adapters);
    setActiveAdapterId(result.activeAdapterId);
    setWorkflowMessage(`Active adapter: ${result.activeAdapterId ?? adapterId}`);
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
        const list = await daemonClient.listProjects();
        const active = list.projects.find((project) => project.id === list.activeProjectId);
        if (active) {
          setActiveProject(active);
          setBrandVoice(active.brandVoice ?? "");
        }
      } catch {
        // Keep UI usable when project restore fails.
      }
    })();
  }, [daemonClient, daemonConnected]);

  const agentsRuntimeLoadedRef = useRef(false);

  useEffect(() => {
    if (!daemonConnected || agentsRuntimeLoadedRef.current) {
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
        setMcpServers(mcpList.servers);
        setAgentsLoadState("ready");
        setMcpLoadState("ready");
        agentsRuntimeLoadedRef.current = true;
      } catch {
        if (!cancelled) {
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
    activeProject,
    projectError,
    clearProjectError: () => setProjectError(null),
    isOpeningProject,
    figmaUrl,
    setFigmaUrl,
    pastedText,
    setPastedText,
    workflowMessage,
    setWorkflowMessage,
    activeSessionId,
    reviewQueue,
    statusFilter,
    setStatusFilter,
    brandVoice,
    setBrandVoice,
    parsedSpreadsheet,
    spreadsheetMapping,
    setSpreadsheetMapping,
    parsedFigmaScope,
    refreshQueue,
    runAudit,
    saveBrandVoice,
    importSpreadsheet,
    createSpreadsheetSession,
    exportSpreadsheet,
    exportSession,
    refreshDaemonStatus,
    connectFigma,
    startFigmaSession,
    startPastedTextReview,
    openProject,
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
