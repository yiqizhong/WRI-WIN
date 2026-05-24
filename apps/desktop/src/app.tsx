import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AgentsScreen } from "./screens/agents-screen";
import { GuidelinesScreen } from "./screens/guidelines-screen";
import { ReviewScreen } from "./screens/review-screen";
import { SettingsScreen } from "./screens/settings-screen";
import { SourcesScreen } from "./screens/sources-screen";
import { AppShell } from "./shell/AppShell";
import { ProductChrome } from "./shell/ProductChrome";
import { descriptionForPath, titleForPath } from "./shell/nav-items";
import { WorkspaceProvider, useWorkspace } from "./workspace-context";

function RoutedApp() {
  const location = useLocation();
  const workspace = useWorkspace();

  return (
    <ProductChrome
      pageTitle={titleForPath(location.pathname)}
      pageDescription={descriptionForPath(location.pathname)}
      daemon={{
        label: workspace.statusView.label,
        detail: workspace.statusView.detail,
        tone: workspace.statusView.tone,
        onRefresh: () => void workspace.refreshDaemonStatus()
      }}
    >
      <Routes>
        <Route path="/" element={<ReviewScreen />} />
        <Route path="/figma" element={<SourcesScreen />} />
        <Route path="/guidelines" element={<GuidelinesScreen />} />
        <Route path="/agents" element={<AgentsScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
      </Routes>
    </ProductChrome>
  );
}

export function App() {
  return (
    <TooltipProvider delay={200}>
      <MemoryRouter>
        <WorkspaceProvider>
          <AppShell>
            <RoutedApp />
          </AppShell>
          <Toaster richColors position="top-right" />
        </WorkspaceProvider>
      </MemoryRouter>
    </TooltipProvider>
  );
}
