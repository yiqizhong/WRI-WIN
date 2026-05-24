import { Button, TextInput, Tile } from "@carbon/react";

import {
  WriterPageGrid,
  WriterPageGridFull,
  WriterPageGridHalf,
  WriterPageStack
} from "../layout/writer-grid";
import { WriterSectionHeader } from "../layout/writer-headings";
import { fillWidth, hugWidth, rowEnd, surfaceFillHeight } from "../layout/writer-sizing";
import { PasteTextChatPanel } from "../paste-text-chat-panel";
import { useWorkspace } from "../workspace-context";
import { WorkflowNotification } from "../workflow-notification";

export function SourcesScreen() {
  const workspace = useWorkspace();

  return (
    <WriterPageGrid gutterMode="narrow" equalRowHeight>
      <WriterPageGridFull>
        <WorkflowNotification />
      </WriterPageGridFull>

      <WriterPageGridHalf fillHeight>
        <WriterPageGrid gutterMode="wide">
          <WriterPageGridFull>
            <Tile className={surfaceFillHeight}>
              <WriterPageStack gap={5}>
                <WriterSectionHeader title="Figma" />
                <TextInput
                  id="figma-url"
                  className={fillWidth}
                  type="url"
                  labelText="Figma URL"
                  placeholder="https://www.figma.com/design/…"
                  value={workspace.figmaUrl}
                  onChange={(event) => workspace.setFigmaUrl(event.target.value)}
                />
                {workspace.parsedFigmaScope ? (
                  <p className="writer-type-helper">Scope: {workspace.parsedFigmaScope}</p>
                ) : null}
                <div className={rowEnd}>
                  <Button
                    kind="ghost"
                    className={hugWidth}
                    disabled={!workspace.figmaUrl.trim()}
                    onClick={() => void workspace.connectFigma()}
                  >
                    Connect
                  </Button>
                  <Button
                    kind="tertiary"
                    className={hugWidth}
                    disabled={!workspace.activeProject || !workspace.figmaUrl.trim()}
                    onClick={() => void workspace.startFigmaSession()}
                  >
                    Start session
                  </Button>
                </div>
              </WriterPageStack>
            </Tile>
          </WriterPageGridFull>
        </WriterPageGrid>
      </WriterPageGridHalf>

      <WriterPageGridHalf fillHeight>
        <PasteTextChatPanel
          client={workspace.daemonClient}
          activeProject={workspace.activeProject}
          daemonConnected={workspace.daemonConnected}
        />
      </WriterPageGridHalf>
    </WriterPageGrid>
  );
}
