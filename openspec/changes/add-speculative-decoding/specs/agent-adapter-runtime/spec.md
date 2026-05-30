## ADDED Requirements

### Requirement: Optional draft model for speculative decoding

The Local Gemma runtime SHALL accept an optional draft model path for speculative decoding, applied consistently to the resident process and the cold-spawn fallback. Speculative decoding SHALL NOT change generated output content.

#### Scenario: Draft model wired when configured

- **WHEN** the runtime starts an inference process and a draft model path is resolved (from `WRITER_LOCAL_DRAFT_MODEL` env, or storage settings with `enabled: true` and a valid path)
- **THEN** it spawns `llama-cli` with `--model-draft <path>`
- **AND** the same flag is applied on the cold-spawn fallback path

#### Scenario: Draft model not wired when disabled

- **WHEN** the runtime starts an inference process and no draft path is resolved (env unset and settings disabled, or settings enabled but path missing)
- **THEN** it spawns `llama-cli` without `--model-draft`
- **AND** generated output is unchanged from the non-speculative baseline

#### Scenario: Env override beats settings

- **WHEN** `WRITER_LOCAL_DRAFT_MODEL` is set to a path
- **THEN** the runtime uses that path regardless of whether the settings toggle is on or off

### Requirement: Draft-load failure falls back to non-speculative

The Local Gemma runtime SHALL recover from a draft-model load failure by respawning once without the draft model and remembering the failure for the runtime's lifetime, so chat does not break when speculative decoding cannot start.

#### Scenario: VRAM failure on draft load respawns without draft

- **WHEN** `llama-cli` fails to load with a VRAM/allocation error during draft-model load
- **AND** the draft path was resolved from storage settings (not from an explicit env override)
- **THEN** the runtime respawns once without `--model-draft`
- **AND** persists `lastError` in storage
- **AND** does not retry the draft for the runtime's lifetime

#### Scenario: Explicit env override disables auto-fallback

- **WHEN** the draft path was resolved from `WRITER_LOCAL_DRAFT_MODEL` and the spawn fails
- **THEN** the runtime surfaces the error instead of silently falling back
- **AND** does not persist `lastError` to storage

#### Scenario: Successful turn after fallback

- **WHEN** the runtime has fallen back to non-speculative for the current lifetime
- **THEN** subsequent turns run at the non-speculative baseline rate
- **AND** the renderer is informed via a `draftModelDisabled` event so it can surface a Settings banner
