## ADDED Requirements

### Requirement: Optional draft model in local model manifest

The local model manifest SHALL allow declaring an optional draft companion model per main model, so install flows can offer a speculative-decoding download as a separate action.

#### Scenario: Manifest with draft model

- **WHEN** a local model manifest declares `draftModel: { url, sha256, sizeBytes, fileName }`
- **THEN** the daemon exposes a draft-install action for that model
- **AND** the renderer surfaces an "Install draft model" affordance in Settings

#### Scenario: Manifest without draft model

- **WHEN** a manifest does not declare a `draftModel` field
- **THEN** the install flow proceeds exactly as before
- **AND** no draft-install affordance is shown for that model

### Requirement: Optional draft model installation with SHA verification

The daemon SHALL be able to install a draft model on demand, with SHA-256 verification, idempotent re-runs, and persistence of the installed path.

#### Scenario: First install downloads and verifies

- **WHEN** the user triggers a draft install for a model whose draft file is absent
- **THEN** the daemon downloads the file to a `.partial` path
- **AND** verifies the SHA-256 matches the manifest before atomic rename
- **AND** persists the installed path in storage
- **AND** leaves `speculativeDecoding.enabled` at its default (`false`)

#### Scenario: Re-install with matching file is a no-op

- **WHEN** the install action is triggered and the target file already exists with the correct SHA
- **THEN** the daemon returns the existing path without re-downloading

#### Scenario: SHA mismatch fails the install

- **WHEN** the downloaded file's SHA does not match the manifest
- **THEN** the daemon deletes the partial file
- **AND** does not write to the target path
- **AND** does not update storage
- **AND** returns a typed error to the renderer
