import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import "../styles/writer-app-frame.css";

import { WriterWindowBackground } from "./WriterWindowBackground";
import { WindowMasthead } from "./WindowMasthead";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();

  return (
    <WriterWindowBackground>
      <div className="writer-app-viewport">
        <WindowMasthead onSettings={() => navigate("/settings")} />
        <div className="writer-app-viewport__content">{children}</div>
      </div>
    </WriterWindowBackground>
  );
}
