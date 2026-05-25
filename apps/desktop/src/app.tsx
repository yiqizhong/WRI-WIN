import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuditDetailScreen } from "./screens/audit-detail-screen";
import { AuditsListScreen } from "./screens/audits-list-screen";
import { FigmaAuditScreen } from "./screens/figma-audit-screen";
import { HomeScreen } from "./screens/home-screen";
import { SettingsScreen } from "./screens/settings-screen";
import { TextCopyScreen } from "./screens/text-copy-screen";
import { AppShell } from "./shell/AppShell";
import { ProductChrome } from "./shell/ProductChrome";
import { WorkspaceProvider } from "./workspace-context";

function RoutedApp() {
  return (
    <ProductChrome>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/figma-audit" element={<FigmaAuditScreen />} />
        <Route path="/audits" element={<AuditsListScreen />} />
        <Route path="/audits/:sessionId" element={<AuditDetailScreen />} />
        <Route path="/text-copy" element={<TextCopyScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
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
