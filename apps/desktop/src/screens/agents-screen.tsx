import { AgentsPanel } from "../agents-panel";
import { WriterPageGrid, WriterPageGridFull, WriterPageStack } from "../layout/writer-grid";
import { useWorkspace } from "../workspace-context";
import { WorkflowNotification } from "../workflow-notification";

export function AgentsScreen() {
  const workspace = useWorkspace();

  return (
    <WriterPageGrid gutterMode="narrow">
      <WriterPageGridFull>
        <WriterPageStack gap={5} fill>
          <WorkflowNotification />
          <AgentsPanel
            client={workspace.daemonClient}
            connected={workspace.daemonConnected}
            onMessage={workspace.setWorkflowMessage}
          />
        </WriterPageStack>
      </WriterPageGridFull>
    </WriterPageGrid>
  );
}
