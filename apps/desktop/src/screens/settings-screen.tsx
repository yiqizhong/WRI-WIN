import { Button, TextArea } from "@carbon/react";

import { WriterPageGrid, WriterPageGridHalf, WriterPageStack } from "../layout/writer-grid";
import { fillWidth, hugWidth } from "../layout/writer-sizing";
import { useWorkspace } from "../workspace-context";
import { WorkflowNotification } from "../workflow-notification";

export function SettingsScreen() {
  const workspace = useWorkspace();

  return (
    <WriterPageGrid gutterMode="wide">
      <WriterPageGridHalf>
        <WriterPageStack>
          <WorkflowNotification />

          {workspace.activeProject ? (
            <div className="writer-active-project">
              <p className="writer-type-section-title">{workspace.activeProject.name}</p>
              <p className="writer-type-helper writer-break-word writer-type-mono">
                {workspace.activeProject.rootPath}
              </p>
            </div>
          ) : (
            <p className="writer-type-body writer-text-secondary">No project open.</p>
          )}

          <TextArea
            id="brand-voice"
            className={fillWidth}
            labelText="Brand voice"
            helperText="Tone and terminology for audits."
            rows={4}
            placeholder="Friendly, direct, no jargon."
            value={workspace.brandVoice}
            onChange={(event) => workspace.setBrandVoice(event.target.value)}
          />

          <Button
            kind="primary"
            className={hugWidth}
            disabled={!workspace.activeProject}
            onClick={() => void workspace.saveBrandVoice()}
          >
            Save voice
          </Button>
        </WriterPageStack>
      </WriterPageGridHalf>
    </WriterPageGrid>
  );
}
