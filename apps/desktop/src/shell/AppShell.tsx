import { type ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { AppUpdateState } from "@writer/contracts";

import "../styles/writer-app-frame.css";

import { WRITER_MODAL_HOST_ID } from "@/lib/writer-modal-host";
import { UpdateModal } from "@/components/writer/update-modal";

import { mastheadConfigForPath } from "./masthead-route";
import { WriterWindowBackground } from "./WriterWindowBackground";
import { WindowMasthead } from "./WindowMasthead";
import { BackdropTuner } from "./BackdropTuner";

type AppShellProps = {
  children: ReactNode;
  hideSettings?: boolean;
};

export function AppShell({ children, hideSettings }: AppShellProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { backTo } = mastheadConfigForPath(pathname);
  const onSettings = hideSettings || pathname === "/settings" ? undefined : () => navigate("/settings");

  const api = window.writerUpdate;
  const [updateState, setUpdateState] = useState<AppUpdateState>({ status: "idle" });
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!api) return;
    // Subscribe first, then pull the cached state so we don't miss events
    // that fired before this component mounted (update-available fires on
    // app launch, often before the renderer is ready).
    const unsub = api.onState(setUpdateState);
    void api.getState().then(setUpdateState);
    return unsub;
  }, [api]);

  return (
    <WriterWindowBackground>
      <div className="writer-app-viewport">
        <WindowMasthead
          {...(backTo ? { onBack: () => navigate(backTo) } : {})}
          {...(onSettings ? { onSettings } : {})}
          {...(api ? { updateState, onUpdateClick: () => setModalOpen(true) } : {})}
        />
        <div className="writer-app-viewport__content">{children}</div>
        <div id={WRITER_MODAL_HOST_ID} className="writer-modal-host" />
      </div>

      {api && (
        <UpdateModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          state={updateState}
          onDownload={() => {
            setUpdateState({ status: "downloading", percent: 0 });
            void api.download().catch(() => undefined);
          }}
          onRestart={() => { void api.restartToInstall().catch(() => undefined); }}
          onRetry={() => {
            setUpdateState({ status: "downloading", percent: 0 });
            void api.download().catch(() => undefined);
          }}
        />
      )}

      <BackdropTuner />
    </WriterWindowBackground>
  );
}
