import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bot,
  CheckCircle2,
  FileText,
  FolderOpen,
  MessageSquareText,
  RefreshCw,
  Settings,
  ShieldCheck,
  TriangleAlert
} from "lucide-react";

import {
  checkDaemonHealth,
  getDaemonStatusView,
  type DaemonConnectionState
} from "./daemon-status";
import { createDaemonClient, DaemonClientError, type ReviewQueue } from "./daemon-client";
import { ReviewQueuePanel } from "./review-queue-panel";
import type { ChangeStatus, Project } from "@writer/contracts";
import "./styles.css";

const navItems = [
  { label: "Review", icon: MessageSquareText },
  { label: "Figma", icon: FileText },
  { label: "Agents", icon: Bot },
  { label: "Settings", icon: Settings }
];

function App() {
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
  const statusView = useMemo(() => getDaemonStatusView(daemonState), [daemonState]);
  const daemonClient = useMemo(() => createDaemonClient(), []);

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
      const session = await daemonClient.createSession({
        projectId: activeProject.id,
        sourceType: "spreadsheet",
        scope: { fileName: parsed.fileName, rows: parsed.rows, mapping: parsed.suggestedMapping }
      });
      setActiveSessionId(session.id);
      setWorkflowMessage(`Imported ${parsed.rows.length} rows from ${parsed.fileName}.`);
    } catch (error) {
      setWorkflowMessage(error instanceof DaemonClientError ? error.message : "Spreadsheet import failed.");
    }
  }

  async function exportSession(format: "markdown" | "json") {
    if (!activeSessionId) {
      return;
    }

    try {
      if (format === "markdown") {
        const markdown = await daemonClient.exportMarkdown(activeSessionId);
        await navigator.clipboard.writeText(markdown);
        setWorkflowMessage("Markdown report copied to clipboard.");
      } else {
        const json = await daemonClient.exportJson(activeSessionId);
        await navigator.clipboard.writeText(JSON.stringify(json, null, 2));
        setWorkflowMessage("JSON report copied to clipboard.");
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
      setWorkflowMessage(`Figma scope ready: ${parsed.suggestedScope.kind} (${parsed.fileKey})`);
    } catch (error) {
      const message =
        error instanceof DaemonClientError ? error.message : "Could not parse the Figma URL.";
      setWorkflowMessage(message);
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
      setWorkflowMessage(`Pasted text session created (${session.id.slice(0, 8)}…). Run audit to populate the queue.`);
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

  useEffect(() => {
    void refreshDaemonStatus();
  }, []);

  useEffect(() => {
    if (daemonState.kind !== "connected" && daemonState.kind !== "degraded") {
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
  }, [daemonClient, daemonState.kind]);

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <div className="brand-mark">W</div>
          <div>
            <strong>Writer</strong>
            <span>UX copy review</span>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item, index) => {
            const Icon = item.icon;

            return (
              <button className={index === 0 ? "nav-item active" : "nav-item"} key={item.label}>
                <Icon aria-hidden="true" size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <section className={`daemon-status ${statusView.tone}`} aria-live="polite">
          <div className="status-heading">
            {statusView.tone === "ready" ? (
              <CheckCircle2 aria-hidden="true" size={18} />
            ) : (
              <TriangleAlert aria-hidden="true" size={18} />
            )}
            <strong>{statusView.label}</strong>
          </div>
          <p>{statusView.detail}</p>
          <button className="icon-text-button" onClick={refreshDaemonStatus}>
            <RefreshCw aria-hidden="true" size={16} />
            <span>Refresh</span>
          </button>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Local platform</p>
            <h1>Review workspace</h1>
          </div>
          <button
            className="primary-action"
            disabled={isOpeningProject || daemonState.kind === "unavailable"}
            onClick={() => void openProject()}
          >
            <FolderOpen aria-hidden="true" size={18} />
            <span>{isOpeningProject ? "Opening…" : "Open Project"}</span>
          </button>
        </header>

        {activeProject ? (
          <p className="project-banner">
            Active project: <strong>{activeProject.name}</strong> — {activeProject.rootPath}
          </p>
        ) : null}

        {projectError ? (
          <p className="project-error" role="alert">
            {projectError}
          </p>
        ) : null}

        {workflowMessage ? <p className="project-banner">{workflowMessage}</p> : null}

        <section className="work-grid" aria-label="Workspace overview">
          <div className="panel hero-panel">
            <div>
              <p className="eyebrow">Next run</p>
              <h2>Figma copy review</h2>
              <p>
                Connect a Figma file, select a frame or flow, and review proposed copy changes before
                anything is written back.
              </p>
            </div>
            <div className="figma-connect">
              <input
                type="url"
                placeholder="https://www.figma.com/design/..."
                value={figmaUrl}
                onChange={(event) => setFigmaUrl(event.target.value)}
                aria-label="Figma file URL"
              />
              <button className="secondary-action" onClick={() => void connectFigma()}>
                <FileText aria-hidden="true" size={18} />
                <span>Connect Figma</span>
              </button>
            </div>
          </div>

          <div className="panel compact-panel">
            <ShieldCheck aria-hidden="true" size={22} />
            <div>
              <h2>Human Gate</h2>
              <p>All comments, replacements, exports, and retries stay behind explicit approval.</p>
            </div>
          </div>

          <div className="panel compact-panel">
            <Bot aria-hidden="true" size={22} />
            <div>
              <h2>Agent adapter</h2>
              <p>Local CLI detection and run streaming will appear here once the daemon is active.</p>
            </div>
          </div>

          <div className="panel hero-panel">
            <div>
              <p className="eyebrow">Light edit</p>
              <h2>Pasted text review</h2>
              <p>Paste copy to start a non-Figma review session through the daemon.</p>
            </div>
            <textarea
              className="paste-input"
              rows={4}
              placeholder="Paste UX copy to review…"
              value={pastedText}
              onChange={(event) => setPastedText(event.target.value)}
            />
            <div className="inline-actions">
              <button
                className="secondary-action"
                disabled={!activeProject || !pastedText.trim()}
                onClick={() => void startPastedTextReview()}
              >
                <MessageSquareText aria-hidden="true" size={18} />
                <span>Start pasted text session</span>
              </button>
              <button className="secondary-action" disabled={!activeProject} onClick={() => void importSpreadsheet()}>
                <FileText aria-hidden="true" size={18} />
                <span>Import CSV/XLSX</span>
              </button>
            </div>
          </div>
        </section>

        <div className="review-toolbar">
          <button className="secondary-action" disabled={!activeSessionId} onClick={() => void runAudit()}>
            Run audit (stub)
          </button>
          <button className="secondary-action" disabled={!activeSessionId} onClick={() => void exportSession("markdown")}>
            Export Markdown
          </button>
          <button className="secondary-action" disabled={!activeSessionId} onClick={() => void exportSession("json")}>
            Export JSON
          </button>
        </div>

        <ReviewQueuePanel
          client={daemonClient}
          sessionId={activeSessionId}
          queue={reviewQueue}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onQueueUpdated={() => void refreshQueue()}
          onMessage={setWorkflowMessage}
        />

        <section className="settings-strip">
          <div>
            <p className="eyebrow">Settings</p>
            <h2>Platform setup</h2>
          </div>
          <div className="guidance-form">
            <label>
              Brand voice
              <textarea
                rows={3}
                placeholder="Friendly, direct, no jargon…"
                value={brandVoice}
                onChange={(event) => setBrandVoice(event.target.value)}
              />
            </label>
            <button className="secondary-action" disabled={!activeProject} onClick={() => void saveBrandVoice()}>
              Save guidance
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

