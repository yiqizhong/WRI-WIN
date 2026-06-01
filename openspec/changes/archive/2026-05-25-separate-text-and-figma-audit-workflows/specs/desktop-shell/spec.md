## ADDED Requirements

### Requirement: Home opens dedicated task workflows

The desktop shell SHALL expose separate `Text` and `Figma Audit` work
entrances from the home screen, and each workflow SHALL provide navigation
back to home without routing through Settings.

#### Scenario: Open Text from home

- **GIVEN** the user is on the home screen
- **WHEN** the user activates the Text card
- **THEN** the desktop app opens the dedicated Text workflow page
- **AND** the page provides an action that returns to home

#### Scenario: Open Figma Audit from home

- **GIVEN** the user is on the home screen
- **WHEN** the user activates the Figma Audit card
- **THEN** the desktop app opens the dedicated Figma Audit Log page
- **AND** the page provides an action that returns to home

### Requirement: Settings contains configuration surfaces only

The desktop shell SHALL NOT expose `Review` or `Sources` as Settings tabs
after the dedicated workflow entrances are available, and SHALL continue to
expose configuration surfaces for Guidelines and Agents.

#### Scenario: Open settings after workflow migration

- **GIVEN** the dedicated Text and Figma Audit workflow pages are available
- **WHEN** the user opens Settings
- **THEN** Guidelines and Agents configuration surfaces are available
- **AND** Review and Sources work-execution tabs are not displayed

### Requirement: Figma audit detail is navigable from batch history

The desktop shell SHALL open a dedicated audit detail workspace for the Batch
selected from the Figma Audit Log and MUST continue to submit approval and
writeback actions through daemon-backed operations.

#### Scenario: Open audit detail

- **GIVEN** the Audit Log displays an existing Figma audit Batch
- **WHEN** the user selects its row
- **THEN** the desktop app opens the detail workspace for that Batch identity
- **AND** shows its existing review, approval, export, and writeback controls

#### Scenario: Leave audit detail

- **GIVEN** the user is viewing an Audit Detail workspace
- **WHEN** the user navigates back
- **THEN** the desktop app returns to the Figma Audit Log page
