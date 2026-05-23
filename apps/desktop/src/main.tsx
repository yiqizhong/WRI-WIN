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
import { createDaemonClient, DaemonClientError } from "./daemon-client";
import type { Project } from "@writer/contracts";
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
  const statusView = useMemo(() => getDaemonStatusView(daemonState), [daemonState]);
  const daemonClient = useMemo(() => createDaemonClient(), []);

  async function refreshDaemonStatus() {
    setDaemonState({ kind: "checking" });
    setDaemonState(await checkDaemonHealth());
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
            <button className="secondary-action">
              <FileText aria-hidden="true" size={18} />
              <span>Connect Figma</span>
            </button>
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
        </section>

        <section className="settings-strip">
          <div>
            <p className="eyebrow">Settings</p>
            <h2>Platform setup</h2>
          </div>
          <div className="settings-list">
            <span>Daemon</span>
            <span>Agents</span>
            <span>MCP</span>
            <span>Exports</span>
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

