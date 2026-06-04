## MODIFIED Requirements

### Requirement: oauth-polling-loop
The Figma MCP OAuth polling loop MUST race the 2 s interval sleep against a
`window.focus` event so that the connection check fires immediately when the user
returns to the Writer window after completing authorization in the browser.

#### Scenario: immediate check on window focus
- **WHEN** the user completes OAuth in the browser and clicks back into the Writer window
- **THEN** `listMcpServers` is called within one event loop tick of the `focus` event firing, without waiting for the 2 s timer

#### Scenario: 2 s fallback when user does not focus
- **WHEN** no `window.focus` event fires within 2 s of a poll cycle starting
- **THEN** the timer resolves and `listMcpServers` is called after 2 s as before

#### Scenario: cancel stops polling
- **WHEN** the user clicks "Cancel sign-in" during the polling loop
- **THEN** `figmaAuthCancelRef.current` is set to true and no further `listMcpServers` calls are made
