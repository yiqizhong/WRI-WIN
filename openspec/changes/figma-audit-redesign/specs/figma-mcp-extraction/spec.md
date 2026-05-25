# figma-mcp-extraction Specification — Delta for `figma-audit-redesign`

> This delta adds a page-frame listing capability backing the Browse-page workflow input, and an audit-completion screenshot capture step. Existing extraction requirements remain unchanged.

## Added Requirements

### Requirement: List frames on a Figma page

The system SHALL expose a daemon endpoint that, given a Figma page URL, returns the list of direct-child frames on that page along with their spatial bounding boxes and an auto-detected flow direction.

#### Scenario: Horizontal flow page

- **GIVEN** a Figma page URL whose frames are arranged predominantly left-to-right (total x-span > 1.2× total y-span)
- **WHEN** client sends `POST /figma/list-page-frames` with `{ pageUrl }`
- **THEN** daemon returns `{ frames, detectedDirection: "horizontal" }`
- **AND** `frames` is ordered by ascending `boundingBox.x`
- **AND** each frame carries `nodeId`, `name`, `parentPath`, `boundingBox: { x, y, width, height }`

#### Scenario: Vertical flow page

- **GIVEN** a page whose frames are arranged predominantly top-to-bottom (total y-span > 1.2× total x-span)
- **WHEN** the endpoint is called
- **THEN** `detectedDirection` is `"vertical"` and frames are ordered by ascending `boundingBox.y`

#### Scenario: Grid or near-square layout fallback

- **GIVEN** a page whose frames neither x-span nor y-span dominates beyond the 1.2× threshold
- **WHEN** the endpoint is called
- **THEN** `detectedDirection` is `"grid"`
- **AND** frames are ordered row-major: bucketed by y (rounded to row height), and within each row by ascending x

#### Scenario: Invalid URL

- **WHEN** the endpoint is called with a URL that is not a Figma `/design/` URL OR does not resolve to a page node
- **THEN** daemon returns a 400-class error referencing `pageUrl`

#### Scenario: MCP not ready

- **WHEN** the endpoint is called while the Figma MCP client is not connected
- **THEN** daemon returns a structured `mcp_not_ready` diagnostic with a recovery action pointing to the Connect Figma flow
- **AND** no synthetic frames are returned

### Requirement: Capture frame screenshots at audit completion

When an audit run reaches `completed` status, the system SHALL capture a screenshot for each in-scope frame via MCP `get_screenshot` and persist the image alongside the session.

#### Scenario: Single Frame audit completes

- **GIVEN** a session whose source scope is a single frame
- **WHEN** the audit reaches `completed`
- **THEN** daemon calls MCP `get_screenshot` for that frame
- **AND** persists the resulting PNG under `~/.writer/sessions/{sessionId}/screenshots/{frameId}.png`
- **AND** records `frameScreenshots: [{ frameId, fileRef }]` on the session

#### Scenario: Workflow audit completes

- **GIVEN** a session whose scope is a flow of multiple frames
- **WHEN** the audit reaches `completed`
- **THEN** daemon captures one screenshot per frame
- **AND** `frameScreenshots` contains one entry per frame in the same order as the flow

#### Scenario: Per-frame screenshot failure is non-fatal

- **WHEN** MCP `get_screenshot` fails for one specific frame
- **THEN** that frame is omitted from `frameScreenshots`
- **AND** the audit run remains `completed` (not failed)
- **AND** a warning diagnostic for the failed screenshot is recorded on the session

## API surface (delta)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/figma/list-page-frames` | List direct-child frames of a Figma page with detected flow direction |

Existing endpoints (`/figma/extract`, etc.) are unchanged on the wire; the audit completion path internally adds the screenshot capture step.

## Dependencies (delta)

- MCP `get_metadata` (already used) — required scope: a page node
- MCP `get_screenshot` (new use site for this capability) — called at audit completion for each in-scope frame
- Existing `figma-mcp-caller.ts` infrastructure
