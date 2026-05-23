import { useEffect, type ReactNode } from "react";
import { Header, HeaderName, SkipToContent } from "@carbon/react";

type AppShellProps = {
  children: ReactNode;
};

function resolvePlatform(): string {
  if (window.writerDesktop?.platform) {
    return window.writerDesktop.platform;
  }
  if (navigator.platform.toLowerCase().includes("mac")) {
    return "darwin";
  }
  if (navigator.userAgent.includes("Windows")) {
    return "win32";
  }
  return "linux";
}

export function AppShell({ children }: AppShellProps) {
  useEffect(() => {
    document.documentElement.dataset.platform = resolvePlatform();
  }, []);

  return (
    <div className="seed-shell" data-shell-contract="seed-v1">
      <SkipToContent />
      <Header aria-label="Writer" className="seed-shell__masthead">
        <HeaderName prefix="">Writer</HeaderName>
      </Header>
      <main className="seed-shell__main" id="main-content">
        {children}
      </main>
    </div>
  );
}
