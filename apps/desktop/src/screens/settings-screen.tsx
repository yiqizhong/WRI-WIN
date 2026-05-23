import { Link } from "react-router-dom";
import { Button, Stack, TextArea } from "@carbon/react";

import { useWorkspace } from "../workspace-context";
import { WorkflowNotification } from "../workflow-notification";

export function SettingsScreen() {
  const workspace = useWorkspace();

  return (
    <Stack gap={7} style={{ maxWidth: 640 }}>
      <p style={{ margin: 0, color: "var(--cds-text-secondary)" }}>
        Platform setup for the active project. Connection settings live on{" "}
        <Link to="/agents">Agents</Link>.
      </p>

      <WorkflowNotification />

      {workspace.activeProject ? (
        <Stack gap={2}>
          <p style={{ margin: 0, fontWeight: 600 }}>{workspace.activeProject.name}</p>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--cds-text-secondary)", wordBreak: "break-all" }}>
            {workspace.activeProject.rootPath}
          </p>
        </Stack>
      ) : (
        <p style={{ margin: 0, color: "var(--cds-text-secondary)" }}>No active project. Use Open project in the header.</p>
      )}

      <TextArea
        id="brand-voice"
        labelText="Brand voice"
        helperText="Friendly, direct, no jargon…"
        rows={4}
        placeholder="Describe tone and terminology for audits."
        value={workspace.brandVoice}
        onChange={(event) => workspace.setBrandVoice(event.target.value)}
      />

      <Button kind="secondary" disabled={!workspace.activeProject} onClick={() => void workspace.saveBrandVoice()}>
        Save guidance
      </Button>
    </Stack>
  );
}
