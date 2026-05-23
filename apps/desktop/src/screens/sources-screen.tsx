import {
  Button,
  Stack,
  TextInput,
  Tile,
  TileAboveTheFoldContent
} from "@carbon/react";

import { PasteTextChatPanel } from "../paste-text-chat-panel";
import { useWorkspace } from "../workspace-context";
import { WorkflowNotification } from "../workflow-notification";

export function SourcesScreen() {
  const workspace = useWorkspace();

  return (
    <Stack gap={7}>
      <p style={{ margin: 0, color: "var(--cds-text-secondary)" }}>
        Figma sessions and paste-text rewrite for review workflows.
      </p>

      <WorkflowNotification />

      <PasteTextChatPanel
        client={workspace.daemonClient}
        activeProject={workspace.activeProject}
        daemonConnected={workspace.daemonConnected}
      />

      <Tile>
        <TileAboveTheFoldContent>
          <Stack gap={5}>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Figma file</h2>
            <TextInput
              id="figma-url"
              type="url"
              labelText="Figma URL"
              placeholder="https://www.figma.com/design/…"
              value={workspace.figmaUrl}
              onChange={(event) => workspace.setFigmaUrl(event.target.value)}
            />
            {workspace.parsedFigmaScope ? (
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--cds-text-secondary)" }}>
                Scope: {workspace.parsedFigmaScope}
              </p>
            ) : null}
            <Stack gap={3} orientation="horizontal">
              <Button kind="secondary" disabled={!workspace.figmaUrl.trim()} onClick={() => void workspace.connectFigma()}>
                Connect Figma
              </Button>
              <Button
                kind="primary"
                disabled={!workspace.activeProject || !workspace.figmaUrl.trim()}
                onClick={() => void workspace.startFigmaSession()}
              >
                Start Figma session
              </Button>
            </Stack>
          </Stack>
        </TileAboveTheFoldContent>
      </Tile>
    </Stack>
  );
}
