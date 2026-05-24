import { InlineAlert } from "@/components/writer/inline-alert";

import { useWorkspace } from "./workspace-context";

export function WorkflowNotification() {
  const { workflowMessage, workflowRecovery, setWorkflowMessage, clearWorkflowRecovery } = useWorkspace();

  if (!workflowMessage) {
    return null;
  }

  const subtitle = workflowRecovery
    ? `${workflowMessage} Use “${workflowRecovery.label}” on the Agents screen.`
    : workflowMessage;

  return (
    <InlineAlert
      kind={workflowRecovery ? "warning" : "info"}
      title=""
      subtitle={subtitle}
      onClose={() => {
        setWorkflowMessage(null);
        clearWorkflowRecovery();
      }}
    />
  );
}
