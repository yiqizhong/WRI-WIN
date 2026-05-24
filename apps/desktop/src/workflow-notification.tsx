import { InlineNotification } from "@carbon/react";

import { useWorkspace } from "./workspace-context";

export function WorkflowNotification() {
  const { workflowMessage, projectError, setWorkflowMessage, clearProjectError } = useWorkspace();

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

  return (
    <InlineNotification
      kind="info"
      lowContrast
      title=""
      subtitle={workflowMessage}
      onClose={() => setWorkflowMessage(null)}
    />
  );
}
