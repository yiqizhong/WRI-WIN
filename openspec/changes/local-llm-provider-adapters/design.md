## Context

Writer is a local-first Figma UX copy review app. The daemon owns privileged work; `packages/agent-adapters` implements `AgentAdapterImplementation` (`detect`, `run`, stream, `cancel`). Bootstrap change delivered echo + stubs and `POST /agents/runs` persistence.

Users want to **link** locally installed **Cursor Agent**, **Codex**, **Claude Code**, and **Devin for Terminal** so review prompts use those LLMs instead of stubs.

References:
- `docs/architecture/local-platform-architecture.md`
- `openspec/changes/bootstrap-local-platform/specs/agent-adapter-runtime/spec.md`
- Cursor programmatic access: `@cursor/sdk` local runtime (optional enhancement to CLI)
- Devin: `devin` CLI (`cli.devin.ai`) — local terminal agent with cloud inference

## Goals / Non-Goals

**Goals:**
- Detect and report availability for four providers with clear setup instructions.
- Run a review prompt through the selected adapter with normalized streaming events and cancel.
- Desktop UI to select active adapter and smoke-test connection.
- Preserve daemon-only launch boundary; shared event schema in `@writer/contracts`.

**Non-Goals:**
- Full agentic tool loop (MCP tools inside provider session) in this change.
- Cloud-only providers without a local CLI entry point.
- Storing provider secrets in Writer cloud; v1 uses env vars / existing CLI login sessions.
- Replacing stub audit in `review-queue` with LLM audit (separate change; this change only proves `agents/runs`).

## Decisions

### D1: Adapter-per-provider on shared CLI runner

- **选择**：One module per provider (`cursor-agent`, `codex`, `claude-code`, `devin`) plus `cli-runner.ts` for spawn, timeout, line buffering, cancel.
- **理由**： Output formats differ; shared process lifecycle avoids duplication.
- **已考虑 alternative**：Single configurable wrapper — rejected; four binaries differ too much for v1.

### D2: Cursor — CLI first, SDK fallback flag

- **选择**：Primary detection via `cursor`/`cursor-agent` CLI; implement stream parser from documented JSON/stream output. Optional follow-up: `@cursor/sdk` `Agent` local when CLI stream is unstable.
- **理由**： Keeps daemon dependency graph small; SDK can be phase 1.5 behind env `WRITER_CURSOR_USE_SDK=1`.
- **Alternative**：SDK-only — better cancel/stream but adds npm dep and API key path distinct from CLI login.

### D3: Codex and Claude — non-interactive print mode

- **选择**： Codex: non-interactive exec with prompt on stdin/argv per Codex CLI docs. Claude: `claude -p` / print mode with `--dangerously-skip-permissions` **disabled**; use read-only or default permission profile for review prompts.
- **理由**： Review tasks are suggest-only; must not silently enable full write bypass.
- **Alternative**：Interactive TTY — rejected for daemon automation.

### D4: Devin — local CLI, hybrid runtime metadata

- **选择**： Adapter `devin` detects `devin` binary; `run` uses `devin -p` single-turn; capability metadata includes `runtime: hybrid` (local CLI, cloud model).
- **理由**： Matches user request for "Devin" while honest about network dependency.
- **Alternative**： Devin MCP from daemon — overlaps tool-runtime; defer.

### D5: Connection smoke via daemon

- **选择**： `POST /agents/smoke { adapterId }` runs ≤30s probe prompt ("Reply OK") and returns truncated text or structured error.
- **理由**： Desktop "Test connection" without creating review session.
- **Alternative**： Only full `agents/runs` — heavier UX.

### D6: Settings persistence

- **选择**： Reuse `activeAdapterId` in store; add optional `adapterPreferences` map (per-id: custom binary path, model hint) in platform store JSON.
- **理由**： Minimal schema churn; path override helps monorepo users.
- **Alternative**： Separate credentials vault — overkill for v1.

## Risks / Trade-offs

- [Risk] CLI output format changes break parsers → Mitigation: adapter-level contract tests with recorded fixtures; version check in `detect()`.
- [Risk] Claude/Codex write files during review → Mitigation: read-only flags, cwd scoped to project root, document risk in setupMessage.
- [Risk] Devin requires login → Mitigation: detect auth via exit code of `devin -p` probe; show `/login` instructions.
- [Trade-off] Four adapters in one change is large → Mitigation: implement detect+smoke for all four, full `run` streaming for echo + two providers first if schedule slips (see tasks).
- [Trade-off] Hybrid Devin vs "fully local" expectation → Mitigation: UI label "Cloud-backed (CLI)".

## Migration Plan

1. Ship adapters behind existing registry; default active adapter remains first `available` adapter (echo deprioritized when real CLI found).
2. No database migration; extend JSON store schema with optional `adapterPreferences`.
3. Rollback: revert to stub adapters via feature flag `WRITER_AGENT_STUBS=1` if needed.
4. Acceptance: manual matrix — each installed CLI → detect true → smoke OK → `agents/runs` completes on pasted-text session.

## Open Questions

1. **User confirmation**: Is hybrid Devin acceptable for v1 "local link" wording?
2. **Cursor**: Confirm preferred invocation (`cursor agent` vs `@cursor/sdk`) on maintainer machines.
3. **Linear**: Create WRI epic + 4 child issues when `/opsx:apply` starts?
