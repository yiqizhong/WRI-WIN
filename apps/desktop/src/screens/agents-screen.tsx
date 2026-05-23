import { Stack } from "@carbon/react";

import { AgentsPanel } from "../agents-panel";
import { useWorkspace } from "../workspace-context";
import { WorkflowNotification } from "../workflow-notification";

export function AgentsScreen() {
  const workspace = useWorkspace();

  return (
    <Stack gap={7}>
      <WorkflowNotification />
      <AgentsPanel
        client={workspace.daemonClient}
        connected={workspace.daemonConnected}
        onMessage={workspace.setWorkflowMessage}
      />
    </Stack>
  );
}
