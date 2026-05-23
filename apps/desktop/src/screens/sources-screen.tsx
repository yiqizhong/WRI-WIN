import {
  Button,
  Stack,
  TextArea,
  TextInput,
  Tile,
  TileAboveTheFoldContent
} from "@carbon/react";

import { SpreadsheetMappingPanel } from "../spreadsheet-mapping-panel";
import { useWorkspace } from "../workspace-context";
import { WorkflowNotification } from "../workflow-notification";

export function SourcesScreen() {
  const workspace = useWorkspace();

  return (
    <Stack gap={7}>
      <p style={{ margin: 0, color: "var(--cds-text-secondary)" }}>
        Figma, pasted text, and spreadsheet imports for review sessions.
      </p>

      <WorkflowNotification />

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

      <Tile>
        <TileAboveTheFoldContent>
          <Stack gap={5}>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Pasted text</h2>
            <TextArea
              id="paste-text"
              labelText="Copy to review"
              rows={4}
              placeholder="Paste UX copy to review…"
              value={workspace.pastedText}
              onChange={(event) => workspace.setPastedText(event.target.value)}
            />
            <Button
              kind="secondary"
              disabled={!workspace.activeProject || !workspace.pastedText.trim()}
              onClick={() => void workspace.startPastedTextReview()}
            >
              Start pasted text session
            </Button>
          </Stack>
        </TileAboveTheFoldContent>
      </Tile>

      <Tile style={{ background: "var(--cds-layer-02)" }}>
        <TileAboveTheFoldContent>
          <Stack gap={5}>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Spreadsheet</h2>
            <Button kind="secondary" disabled={!workspace.activeProject} onClick={() => void workspace.importSpreadsheet()}>
              Import CSV or XLSX
            </Button>
            <Button
              kind="tertiary"
              disabled={!workspace.parsedSpreadsheet || !workspace.spreadsheetMapping}
              onClick={() => void workspace.createSpreadsheetSession()}
            >
              Create spreadsheet session
            </Button>
          </Stack>
        </TileAboveTheFoldContent>
      </Tile>

      <SpreadsheetMappingPanel
        parsed={workspace.parsedSpreadsheet}
        mapping={workspace.spreadsheetMapping}
        onMappingChange={workspace.setSpreadsheetMapping}
      />
    </Stack>
  );
}
