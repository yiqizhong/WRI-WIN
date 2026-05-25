import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import "../styles/writer-app-frame.css";

import { mastheadConfigForPath } from "./masthead-route";
import { WriterWindowBackground } from "./WriterWindowBackground";
import { WindowMasthead } from "./WindowMasthead";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { title, backTo } = mastheadConfigForPath(pathname);

  return (
    <WriterWindowBackground>
      <div className="writer-app-viewport">
        <WindowMasthead
          title={title}
          {...(backTo ? { onBack: () => navigate(backTo) } : {})}
          onSettings={() => navigate("/settings")}
        />
        <div className="writer-app-viewport__content">{children}</div>
      </div>
    </WriterWindowBackground>
  );
}
