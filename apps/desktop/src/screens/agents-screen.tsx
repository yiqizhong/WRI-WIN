import { AgentsPanel } from "../agents-panel";
import { useWorkspace } from "../workspace-context";

export function AgentsScreen() {
  const workspace = useWorkspace();

  return (
    <AgentsPanel
      client={workspace.daemonClient}
      connected={workspace.daemonConnected}
      statusView={workspace.statusView}
    />
  );
}
