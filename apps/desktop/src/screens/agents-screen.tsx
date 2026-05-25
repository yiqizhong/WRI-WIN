import { AgentsPanel } from "../agents-panel";
import { useWorkspace } from "../workspace-context";

export function AgentsScreen() {
  const workspace = useWorkspace();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AgentsPanel
        client={workspace.daemonClient}
        connected={workspace.daemonConnected}
        statusView={workspace.statusView}
      />
    </div>
  );
}
