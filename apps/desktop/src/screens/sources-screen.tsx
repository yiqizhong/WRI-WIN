import {
  Button,
  Stack,
  TextInput,
  Tile,
  TileAboveTheFoldContent
} from "@carbon/react";

import {
  WriterPageGrid,
  WriterPageGridFull,
  WriterPageGridThird,
  WriterPageStack
} from "../layout/writer-grid";
import { fillWidth, hugHeight, hugWidth, row, surfaceFillHeight } from "../layout/writer-sizing";
import { PasteTextChatPanel } from "../paste-text-chat-panel";
import { SpreadsheetMappingPanel } from "../spreadsheet-mapping-panel";
import { useWorkspace } from "../workspace-context";
import { WorkflowNotification } from "../workflow-notification";

export function SourcesScreen() {
  const workspace = useWorkspace();

  return (
    <WriterPageGrid gutterMode="narrow" equalRowHeight>
      <WriterPageGridFull>
        <WriterPageStack gap={5}>
          <p className="writer-intro-copy" style={{ color: "var(--cds-text-secondary)" }}>
            Figma sessions, paste-text rewrite, and spreadsheet import — three source types on the 2× grid.
          </p>
          <WorkflowNotification />
        </WriterPageStack>
      </WriterPageGridFull>

      <WriterPageGridThird position="leading" fillHeight>
        <WriterPageGrid gutterMode="wide">
          <WriterPageGridFull>
            <Tile className={surfaceFillHeight}>
              <TileAboveTheFoldContent>
                <Stack gap={5}>
                  <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Figma file</h2>
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
                    <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--cds-text-secondary)" }}>
                      Scope: {workspace.parsedFigmaScope}
                    </p>
                  ) : null}
                  <Stack gap={3} orientation="horizontal" className={`${row} ${hugHeight}`}>
                    <Button
                      kind="secondary"
                      className={hugWidth}
                      disabled={!workspace.figmaUrl.trim()}
                      onClick={() => void workspace.connectFigma()}
                    >
                      Connect Figma
                    </Button>
                    <Button
                      kind="primary"
                      className={hugWidth}
                      disabled={!workspace.activeProject || !workspace.figmaUrl.trim()}
                      onClick={() => void workspace.startFigmaSession()}
                    >
                      Start Figma session
                    </Button>
                  </Stack>
                </Stack>
              </TileAboveTheFoldContent>
            </Tile>
          </WriterPageGridFull>
        </WriterPageGrid>
      </WriterPageGridThird>

      <WriterPageGridThird position="center" fillHeight>
        <PasteTextChatPanel
          client={workspace.daemonClient}
          activeProject={workspace.activeProject}
          daemonConnected={workspace.daemonConnected}
        />
      </WriterPageGridThird>

      <WriterPageGridThird position="trailing" fillHeight>
        <WriterPageGrid gutterMode="wide">
          <WriterPageGridFull>
            <WriterPageStack gap={5} fill>
              <Tile className={`writer-surface ${hugHeight}`}>
                <Stack gap={5}>
                  <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Spreadsheet</h2>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--cds-text-secondary)" }}>
                    Import Excel or CSV copy for row-by-row review.
                  </p>
                  <Button
                    kind="secondary"
                    className={hugWidth}
                    disabled={!workspace.activeProject}
                    onClick={() => void workspace.importSpreadsheet()}
                  >
                    Import spreadsheet
                  </Button>
                </Stack>
              </Tile>
              <SpreadsheetMappingPanel
                parsed={workspace.parsedSpreadsheet}
                mapping={workspace.spreadsheetMapping}
                onMappingChange={workspace.setSpreadsheetMapping}
              />
              {workspace.parsedSpreadsheet && workspace.spreadsheetMapping ? (
                <Button
                  kind="primary"
                  className={hugWidth}
                  disabled={!workspace.activeProject}
                  onClick={() => void workspace.createSpreadsheetSession()}
                >
                  Create spreadsheet session
                </Button>
              ) : null}
            </WriterPageStack>
          </WriterPageGridFull>
        </WriterPageGrid>
      </WriterPageGridThird>
    </WriterPageGrid>
  );
}
