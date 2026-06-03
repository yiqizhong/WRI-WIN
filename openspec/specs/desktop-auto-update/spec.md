# desktop-auto-update Specification

## Purpose
TBD - created by archiving change add-windows-auto-update-r2. Update Purpose after archive.
## Requirements
### Requirement: Production-only update checks

The desktop app SHALL perform update activity only in packaged production builds and
MUST NOT check for, download, or install updates while running in development.

#### Scenario: No update activity in development

- **WHEN** the app runs from the local development environment (`app.isPackaged` is false)
- **THEN** the updater does not contact the R2 update directory
- **AND** no update affordance is shown to the user

#### Scenario: Auto-check on packaged launch

- **WHEN** a packaged Windows build launches
- **THEN** the app checks the configured R2 update directory exactly once
- **AND** reports a checking state to the renderer

### Requirement: Detect a newer version from the R2 generic feed

The app SHALL detect a newer published version by reading the generic update
metadata served from the Cloudflare R2 update directory.

#### Scenario: Newer version available

- **WHEN** the R2 update directory advertises a version newer than the installed version
- **THEN** the app reports an available state including the new version identifier
- **AND** does not download the update until the user requests it

#### Scenario: Already up to date

- **WHEN** the R2 update directory advertises no version newer than the installed version
- **THEN** the app reports a not-available state
- **AND** takes no further update action

### Requirement: User-initiated download with progress

The app SHALL download an available update only on explicit user action and SHALL
report download progress and failures.

#### Scenario: User downloads an available update

- **WHEN** an update is available and the user requests download
- **THEN** the app downloads the update package from the R2 update directory
- **AND** reports download progress to the renderer

#### Scenario: Download failure is recoverable

- **WHEN** a download fails because the update directory is unreachable or the transfer is interrupted
- **THEN** the app reports an error state with a message
- **AND** remains usable
- **AND** allows the user to retry the check or download

### Requirement: Integrity verification before install

The app SHALL verify the integrity of a downloaded update before it can be installed
and MUST NOT install a package that fails verification.

#### Scenario: Corrupted download fails verification

- **WHEN** a downloaded update package does not match the checksum published in the update metadata
- **THEN** the app reports an error state
- **AND** does not mark the update as ready to install

### Requirement: Restart to install

The app SHALL install a downloaded update only on explicit user action and SHALL
relaunch as the new version.

#### Scenario: User restarts to install

- **WHEN** an update has been downloaded and the user requests restart-to-install
- **THEN** the app quits, installs the downloaded update, and relaunches

#### Scenario: App relaunches as the new version

- **WHEN** the installed version A applies a downloaded version B
- **THEN** after relaunch the app reports version B as the running version

### Requirement: Preserve user data, logs, and local model files across updates

Applying an update MUST NOT delete, move, or overwrite user data, logs, or local
model files stored under the user data root (`~/.writer`). The updater and installer
MUST NOT write application user data inside the install directory or `resourcesPath`.

#### Scenario: User records persist after update

- **WHEN** version A holds user records under `~/.writer` and is updated to version B
- **THEN** the user records remain available and unchanged after the update

#### Scenario: Logs persist after update

- **WHEN** version A has written logs under `~/.writer/logs` and is updated to version B
- **THEN** the existing log files remain present after the update

#### Scenario: Local model files persist and are not re-downloaded

- **WHEN** version A has an installed local model file under `~/.writer/models` and is updated to version B
- **THEN** the model file remains present and unchanged after the update
- **AND** version B does not re-download the model

### Requirement: Renderer drives updates only through main-process IPC

The renderer SHALL request update actions and observe update state only through a
preload bridge over IPC, and MUST NOT perform privileged update work directly.

#### Scenario: Renderer triggers update actions via the preload bridge

- **WHEN** the user interacts with the update affordance to check, download, or restart-to-install
- **THEN** the renderer invokes the corresponding preload bridge method
- **AND** the main process performs the privileged update operation

#### Scenario: Update state is surfaced to the renderer

- **WHEN** the main process changes update state
- **THEN** the renderer receives the new state through the preload bridge subscription

### Requirement: Safe publish ordering

Update publishing SHALL upload update package artifacts before publishing the update
metadata, so a client never sees metadata that points at a not-yet-available package.

#### Scenario: Package artifacts uploaded before metadata

- **WHEN** a new version is published to the R2 update directory
- **THEN** the installer and its block map are uploaded first
- **AND** the update metadata file is uploaded last

