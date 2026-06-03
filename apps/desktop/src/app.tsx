import { useState } from "react";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuditsRouteLayout } from "./layout/audits-route-layout";
import { AuditDetailScreen } from "./screens/audit-detail-screen";
import { AuditsListScreen } from "./screens/audits-list-screen";
import { FigmaAuditScreen } from "./screens/figma-audit-screen";
import { FigmaGuidelineGeneratorScreen } from "./screens/figma-guideline-generator-screen";
import { GuidelineDetailScreen } from "./screens/guideline-detail-screen";
import { GuidelinesListScreen } from "./screens/guidelines-list-screen";
import { GuidelinesRouteLayout } from "./layout/guidelines-route-layout";
import { HomeScreen } from "./screens/home-screen";
import { SettingsScreen } from "./screens/settings-screen";
import { TextCopyScreen } from "./screens/text-copy-screen";
import { AppShell } from "./shell/AppShell";
import { ProductChrome } from "./shell/ProductChrome";
import { WorkspaceProvider, useWorkspace } from "./workspace-context";
import { WelcomeScreen } from "./screens/welcome-screen";

function RoutedApp({ showWelcome, onGo }: { showWelcome: boolean; onGo: () => void }) {
  const { daemonConnected } = useWorkspace();

  if (showWelcome) {
    return daemonConnected ? <WelcomeScreen onGo={onGo} /> : null;
  }

  return (
    <ProductChrome>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/figma-audit" element={<FigmaAuditScreen />} />
        <Route path="/guide" element={<FigmaGuidelineGeneratorScreen />} />
        <Route path="/guide/log" element={<GuidelinesRouteLayout />}>
          <Route index element={<GuidelinesListScreen />} />
          <Route path=":sessionId" element={<GuidelineDetailScreen />} />
        </Route>
        <Route path="/audits" element={<AuditsRouteLayout />}>
          <Route index element={<AuditsListScreen />} />
          <Route path=":sessionId" element={<AuditDetailScreen />} />
        </Route>
        <Route path="/text-copy" element={<TextCopyScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ProductChrome>
  );
}

export function App() {
  const [showWelcome, setShowWelcome] = useState(true);

  return (
    <TooltipProvider delay={200}>
      <MemoryRouter>
        <WorkspaceProvider>
          <AppShell hideSettings={showWelcome}>
            <RoutedApp showWelcome={showWelcome} onGo={() => setShowWelcome(false)} />
          </AppShell>
          <Toaster richColors position="top-right" />
        </WorkspaceProvider>
      </MemoryRouter>
    </TooltipProvider>
  );
}
