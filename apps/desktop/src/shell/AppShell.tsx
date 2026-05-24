import type { ReactNode } from "react";

import "../styles/writer-app-frame.css";

import { WriterWindowBackground } from "./WriterWindowBackground";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <WriterWindowBackground>
      <div className="writer-app-viewport">{children}</div>
    </WriterWindowBackground>
  );
}
