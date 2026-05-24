import { InlineNotification } from "@carbon/react";

import { useWorkspace } from "./workspace-context";

export function WorkflowNotification() {
  const { workflowMessage, workflowRecovery, projectError, setWorkflowMessage, clearProjectError, clearWorkflowRecovery } =
    useWorkspace();

  if (projectError) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        title="Project error"
        subtitle={projectError}
        onClose={clearProjectError}
      />
    );
  }

  if (!workflowMessage) {
    return null;
  }

  const subtitle = workflowRecovery
    ? `${workflowMessage} Use “${workflowRecovery.label}” on the Agents screen.`
    : workflowMessage;

  return (
    <InlineNotification
      kind={workflowRecovery ? "warning" : "info"}
      lowContrast
      title=""
      subtitle={subtitle}
      onClose={() => {
        setWorkflowMessage(null);
        clearWorkflowRecovery();
      }}
    />
  );
}
