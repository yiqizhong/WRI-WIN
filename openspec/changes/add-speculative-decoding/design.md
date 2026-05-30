# Design — add-speculative-decoding

## Context

- Model: Gemma 4 E4B Q8_0 (~8.6 GB). Runtime: bundled `llama-cli` b9384, CUDA 12.8, `-ngl 99`, `-fa on`, `-ub 1024`, 16K context (after the two prior changes).
- Measured decode: ~40 t/s. Q8 bandwidth ceiling: `672 GB/s ÷ 8.6 GB ≈ 78 t/s`. Current speed is ~51% of ceiling; remaining gap is bandwidth, not compute.
- Google publishes a **dedicated draft model** alongside Gemma 4 E4B specifically for speculative decoding (per ai.google.dev/gemma/docs/core). Draft size is in the ~500 MB Q4 range.
- llama.cpp supports speculative decoding natively via `--model-draft <path>`. Tunable via `--draft-max` (default 16) and `--draft-min` (default 5).

## Goals (no quality loss)

1. Make Local Gemma decode faster by ~30–75% (target 55–70 t/s) without changing generated output.
2. Keep the change inside the established runtime spawn-arg pipeline (`buildSpawnArgs` + cold-spawn parity).
3. Give the user an opt-in install + opt-in activation path, with a graceful fallback if VRAM is tight.

## Non-goals

- Tuning UI for draft-max / draft-min (env only).
- Auto-download on main-model install.
- Auto-enable toggle on install.
- Multiple draft models per main model.
- Speculative decoding for non-Gemma adapters.
- Bundling the draft inside the app installer.

## Layer boundaries

| Layer | Responsibility |
|---|---|
| `apps/daemon` — manifest | Declarative spec of the optional `draftModel` field per main model |
| `apps/daemon` — install flow | Download + SHA-verify + place draft file alongside main model |
| `apps/daemon` — routes | `POST /local-model/draft/install`, `PUT /local-model/draft/enabled` |
| `packages/storage` | Persist `{ enabled, lastError? }` slice with migration default |
| `packages/contracts` | DTO surface for renderer status |
| `packages/agent-adapters` — runtime | Resolve path, append `--model-draft`, detect+fall-back on draft-load failure |
| `apps/desktop` — Settings | Install button, toggle, error banner |

No daemon ↔ renderer change beyond the existing adapter status protocol (one extra optional field).

## Decisions

### 1. Manifest gains optional `draftModel` field

- Shape: `{ url: string; sha256: string; sizeBytes: number; fileName: string }`. All four required when the parent has a draft.
- Resolved file path: `<modelDir>/<fileName>` — sibling of the main GGUF, predictable for the runtime resolver.
- Backwards compatible: absent on existing manifests (e.g. older models) — install flow simply hides the "Install draft" button.

### 2. Install flow + storage

- New action `installDraftModel(modelId)`:
  - Idempotent: if file exists and SHA matches, no-op returns the path.
  - Streams download to a `.partial` file, atomic rename on SHA verify pass, deletes on failure.
  - Updates storage with the installed path on success.
- Storage adds `localGemma.speculativeDecoding = { enabled: false, lastError?: string }`. Default-false is critical — installing the draft does **not** turn it on.

### 3. Pure resolver: `resolveDraftModelPath(envOverride, settings)`

- Precedence:
  1. `WRITER_LOCAL_DRAFT_MODEL` env var → use that path verbatim (power-user override; respected even if toggle is off).
  2. `settings.enabled === true` and `settings.path` exists → use it.
  3. Otherwise → `null`.
- Pure function; no I/O; no file-exists check (the install flow already verified the file). Caller passes `process.env["WRITER_LOCAL_DRAFT_MODEL"]` and `settings`.

### 4. Extend `buildSpawnArgs` (the shared one)

- New input field: `draftModelPath: string | null`.
- When non-null, append `--model-draft <path>`. When null, skip.
- Position: place after the KV-cache flags and before `-sys`, so the order of new flags stays in the same "decoder controls" block introduced by `tune-local-inference-speed`.
- Both spawn paths (resident process and cold-spawn fallback in `local-gemma-adapter.ts`) consume this. The cold-spawn path mirrors the same arg directly (matches the established two-path pattern from the two prior changes).

### 5. Failure detection and one-shot fallback

- Failure signature for llama-cli when the draft can't load: a VRAM/allocation error during model load whose log line names the draft path. Detector is a string check on the spawn-failure stderr.
- Behavior: respawn **once** without `--model-draft`, set `lastError`, emit `draftModelDisabled` event. For the runtime's lifetime, do not retry the draft.
- Matches the FP16→q8 KV fallback rule from `expand-local-context-window`: try the optimistic path once, remember the failure, never retry within the runtime's lifetime.
- An explicit `WRITER_LOCAL_DRAFT_MODEL` env value disables auto-fallback (the user explicitly asked for that draft; surface the error instead of silently dropping it).

### 6. Optional perf-log extension

- When `WRITER_LOCAL_PERF_LOG=1` and speculative decoding is active, also log a draft acceptance summary if llama-cli's footer exposes it (e.g. `draft accepted N/M`). If the footer doesn't include acceptance counts in this binary version, log just the prompt/eval t/s as today — no behavior change otherwise.
- Pure parser tolerates the field missing.

### 7. UI surface (minimal)

- New "Speed boost" sub-section inside Settings → Local Gemma.
- Two states:
  - **Not installed:** "Install draft model (~500 MB)" button. Click → `POST /local-model/draft/install` → progress → done.
  - **Installed:** "Speculative decoding" toggle. Banner area shows `lastError` if present with [Retry] / [Disable] buttons.
- No tuning controls.

## Risks / trade-offs

- **VRAM:** Main model + 16K KV + draft + draft KV ≈ tight on 12 GB. The fallback path is the safety net; the banner is the user-facing communication.
- **Acceptance rate variance:** Highly domain-dependent. Google's purpose-built draft should average ≥3 accepted tokens per draft step on Gemma-style copy work, but we won't know real numbers until §verification.
- **Cold-start cost:** Two models load on first turn after enable. Existing eviction logic already pays this on session change; spec decoding adds a similar one-time cost when the toggle flips.
- **llama-cli footer format:** Acceptance-rate fields may not exist in this binary version. The perf-log extension treats them as optional, so the change works regardless.

## Verification

- `npm run typecheck`, `npm run test`.
- `openspec validate add-speculative-decoding --type change --strict`.
- Manual (live GPU): install draft, toggle on, run several chat turns with `WRITER_LOCAL_PERF_LOG=1`. Record eval t/s before vs after. Expected: ≥30% rise. Force a VRAM failure (oversubscribe `WRITER_LOCAL_UBATCH`); confirm banner appears, fallback works, chat continues at ~40 t/s.
