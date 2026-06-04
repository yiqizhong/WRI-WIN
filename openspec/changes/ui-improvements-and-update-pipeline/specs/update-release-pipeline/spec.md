## ADDED Requirements

### Requirement: mandatory-release-notes
The upload script (`scripts/r2-upload.mjs`) SHALL abort with exit code 1 and a
descriptive error message if no changelog entry exists for the target version in
`CHANGELOG.md`. The upload SHALL NOT proceed without release notes.

#### Scenario: upload aborts on missing changelog entry
- **WHEN** `CHANGELOG.md` has no `## [VERSION]` section for the current `VERSION`
- **THEN** the script exits with code 1 and prints the missing section name; no files are uploaded

#### Scenario: upload proceeds with valid changelog entry
- **WHEN** `CHANGELOG.md` contains a `## [VERSION]` section with non-empty content
- **THEN** the script patches `latest.yml` and proceeds to upload

---

### Requirement: yaml-release-notes-patch
The upload script SHALL patch `releaseNotes` in `latest.yml` using `js-yaml`
parse/set/dump, never regex substitution, to guarantee no duplicate keys are produced.

#### Scenario: no duplicate releaseNotes key
- **WHEN** electron-builder already emits a `releaseNotes` field in `latest.yml`
- **THEN** patching replaces the existing field; the output YAML has exactly one `releaseNotes` key

#### Scenario: releaseNotes inserted when absent
- **WHEN** `latest.yml` has no `releaseNotes` field
- **THEN** patching adds it; the output YAML has exactly one `releaseNotes` key

---

### Requirement: block-map-size-injection
The upload script SHALL inject `blockMapSize` into each file entry in `latest.yml`
from the corresponding `.blockmap` file size, so electron-updater activates
differential block-level downloads.

#### Scenario: blockMapSize injected from blockmap file
- **WHEN** `latest.yml` contains a file entry whose `url` is `Writer Setup x.y.z.exe`
  and `Writer Setup x.y.z.exe.blockmap` exists in the dist directory
- **THEN** `files[0].blockMapSize` is set to the blockmap file's byte size in the patched `latest.yml`

#### Scenario: blockMapSize skipped with warning when blockmap absent
- **WHEN** no `.blockmap` file exists for a given file entry
- **THEN** the script logs a warning and leaves `blockMapSize` unset for that entry; the rest of the upload continues

---

### Requirement: app-icon-embedding
The `Writer.exe` executable SHALL have the custom `build-resources/icon.ico` embedded
via an `afterPack` rcedit hook, independently of `signAndEditExecutable`.

#### Scenario: icon applied during build
- **WHEN** `npm run build:app` completes successfully
- **THEN** the build log contains `• icon applied to Writer.exe`

#### Scenario: build fails loudly if rcedit fails
- **WHEN** `rcedit.exe` cannot be found or returns a non-zero exit code
- **THEN** the `afterPack` hook throws, causing the electron-builder process to exit with an error
