import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import "../styles/writer-app-frame.css";

import { WRITER_MODAL_HOST_ID } from "@/lib/writer-modal-host";

import { mastheadConfigForPath } from "./masthead-route";
import { WriterWindowBackground } from "./WriterWindowBackground";
import { WindowMasthead } from "./WindowMasthead";
import { BackdropTuner } from "./BackdropTuner";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { backTo } = mastheadConfigForPath(pathname);
  const onSettings = pathname === "/settings" ? undefined : () => navigate("/settings");

  return (
    <WriterWindowBackground>
      <div className="writer-app-viewport">
        <WindowMasthead
          {...(backTo ? { onBack: () => navigate(backTo) } : {})}
          {...(onSettings ? { onSettings } : {})}
        />
        <div className="writer-app-viewport__content">{children}</div>
        <div id={WRITER_MODAL_HOST_ID} className="writer-modal-host" />
      </div>
      <BackdropTuner />
    </WriterWindowBackground>
  );
}
