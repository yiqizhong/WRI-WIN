import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { AgentsScreen } from "./screens/agents-screen";
import { ReviewScreen } from "./screens/review-screen";
import { SettingsScreen } from "./screens/settings-screen";
import { SourcesScreen } from "./screens/sources-screen";
import { AppShell } from "./shell/AppShell";
import { ProductChrome } from "./shell/ProductChrome";
import { titleForPath } from "./shell/nav-items";
import { WorkspaceProvider, useWorkspace } from "./workspace-context";

function RoutedApp() {
  const location = useLocation();
  const workspace = useWorkspace();

  return (
    <ProductChrome
      pageTitle={titleForPath(location.pathname)}
      daemon={{
        label: workspace.statusView.label,
        detail: workspace.statusView.detail,
        tone: workspace.statusView.tone,
        onRefresh: () => void workspace.refreshDaemonStatus()
      }}
      onOpenProject={() => void workspace.openProject()}
      openProjectDisabled={workspace.isOpeningProject || workspace.daemonState.kind === "unavailable"}
      openProjectLoading={workspace.isOpeningProject}
    >
      <Routes>
        <Route path="/" element={<ReviewScreen />} />
        <Route path="/figma" element={<SourcesScreen />} />
        <Route path="/agents" element={<AgentsScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
      </Routes>
    </ProductChrome>
  );
}

export function App() {
  return (
    <div className="cds--g10">
      <MemoryRouter>
        <WorkspaceProvider>
          <AppShell>
            <RoutedApp />
          </AppShell>
        </WorkspaceProvider>
      </MemoryRouter>
    </div>
  );
}
