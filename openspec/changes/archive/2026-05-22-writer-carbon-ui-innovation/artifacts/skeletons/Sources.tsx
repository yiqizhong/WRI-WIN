// artifacts/skeletons/Sources.tsx · Architect Pass 3

/**
 * Intent:
 * - Session sources only — not on Review (D3)
 * - pattern: Forms · three stacked sections
 * - Page subtitle: "Figma, pasted text, and spreadsheet" (gate1 A3)
 * - Spreadsheet mapping = B unit surface-2 when visible
 */

import { Button, Stack, TextArea, TextInput, Tile, TileAboveTheFoldContent } from "@carbon/react";
import { Link as CarbonLink } from "@carbon/react";

export default function Sources() {
  return (
    <Stack gap={7}>
      <p style={{ margin: 0, color: "var(--cds-text-secondary)" }}>
        Figma, pasted text, and spreadsheet imports for review sessions.
      </p>

      <Tile>
        <TileAboveTheFoldContent>
          <Stack gap={5}>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Figma file</h2>
            {/* @builder: TextInput type=url placeholder Figma design URL — wire connect + scope banner */}
            <TextInput id="figma-url" labelText="Figma URL" placeholder="https://www.figma.com/design/…" />
            <Stack gap={3} orientation="horizontal">
              <Button kind="secondary">Connect Figma</Button>
              <Button kind="primary">Start Figma session</Button>
            </Stack>
          </Stack>
        </TileAboveTheFoldContent>
      </Tile>

      <Tile>
        <TileAboveTheFoldContent>
          <Stack gap={5}>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Pasted text</h2>
            <TextArea id="paste-text" labelText="Copy to review" rows={4} placeholder="Paste UX copy to review…" />
            <Button kind="secondary">Start pasted text session</Button>
          </Stack>
        </TileAboveTheFoldContent>
      </Tile>

      <Tile style={{ background: "var(--cds-layer-02)" }}>
        <TileAboveTheFoldContent>
          <Stack gap={5}>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Spreadsheet</h2>
            {/* @builder: Import button → pickSpreadsheetFile; mapping grid; create session */}
            <Button kind="secondary">Import CSV or XLSX</Button>
            <CarbonLink href="#">Create spreadsheet session</CarbonLink>
          </Stack>
        </TileAboveTheFoldContent>
      </Tile>
    </Stack>
  );
}
