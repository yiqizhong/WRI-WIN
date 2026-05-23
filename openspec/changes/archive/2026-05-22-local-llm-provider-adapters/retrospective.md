# Retrospective: local-llm-provider-adapters

> Written: 2026-05-22 CDT (after verify passed)
> Commit range: `1b857d7..cd77019`
> Worktree: merged to main

---

## 0. Evidence

- **Commit range**: `1b857d7..cd77019` (2 commits)
- **Diff size**: +1634 / -49 lines across 43 files
- **Tasks done**: 17/17 (`tasks.md`)
- **Active hours**: ~1 hour from commit timestamps and Linear completion updates
- **Subagent dispatches**: n/a; implementation commit is co-authored by Cursor
- **New external dependencies**: none
- **Bugs encountered post-merge**: none observed in this checkout
- **OpenSpec validate state at archive**: pass (`openspec validate local-llm-provider-adapters --type change --strict`)
- **Test coverage signal**: `npm run typecheck` passed; `npm run test` passed with 31 test files, 63 passed, 1 skipped

Commit chain:

```text
adde47d Add local LLM provider adapters for Cursor, Codex, Claude, and Devin.
cd77019 Improve CLI agent test UX and document cancelled BYOK work.
```

---

## 1. Wins

- The implementation reached all 17 planned tasks in `openspec/changes/local-llm-provider-adapters/tasks.md`, covering shared CLI runner utilities, four provider adapters, daemon detect/smoke routes, desktop test UX, docs, and verification.
- The adapter work stayed inside the intended boundaries: CLI spawning lives in `packages/agent-adapters`, daemon routes are in `apps/daemon/src/routes/platform.ts`, and renderer code calls typed daemon-client methods instead of launching processes directly.
- Verification is broad for this slice: `npm run test` covers daemon, desktop, agent adapters, contracts, review-core, spreadsheet, storage, and tool-runtime workspaces; `npm run typecheck` passed across all workspaces.
- The desktop connection UX improved after the first implementation commit through `apps/desktop/src/agent-test-status.tsx` and related panel/client changes in `cd77019`.

## 2. Misses

- 🟡 [painful | evidence: `openspec/changes/local-llm-provider-adapters/verify.md`] The verify artifact records the manual matrix but leaves checklist boxes unchecked, so the file does not itself prove installed CLI end-to-end runs on this machine.
- 🟡 [painful | evidence: `cd77019`] The follow-up commit mixed local adapter UX cleanup with cancelled BYOK documentation, making the retrospective commit range less clean than a single-purpose change range.
- 📌 [nit | evidence: `openspec/changes/local-llm-provider-adapters/plan.md`] The plan checklist remains unchecked even though `tasks.md` is complete, so `plan.md` is less useful as post-implementation evidence.

## 3. Plan deviations

| Plan task | What changed | Why |
|-----------|--------------|-----|
| Task 4 | Cursor stayed CLI-first; `@cursor/sdk` remains an optional future path | The proposal chose all providers through local interfaces without adding a new SDK dependency |
| Task 7 | Desktop UX gained a dedicated agent test-status component | The first panel implementation needed clearer per-adapter smoke feedback |
| Task 8 | Verification relied on automated tests plus documented manual matrix | Local availability/auth for all CLIs cannot be guaranteed in this checkout |

## 4. Skill / workflow compliance

| Skill                                            | Used |
|--------------------------------------------------|------|
| superpowers:brainstorming                        | ✓ |
| superpowers:writing-plans                        | ✓ |
| superpowers:using-git-worktrees                  | ✗ |
| superpowers:subagent-driven-development          | ✗ |
| (transitive) superpowers:test-driven-development | ✓ |
| (transitive) superpowers:requesting-code-review  | ✗ |
| superpowers:finishing-a-development-branch       | ✗ |

### Deliberately Skipped Skills

- **`superpowers:using-git-worktrees`**
  - **What was skipped**: A separate feature worktree was not preserved for this change.
  - **Why this cycle**: Evidence available at retro time shows the work already merged to `main` (`git log --oneline` ends at `cd77019` on `main`), with no active worktree metadata in the checkout.
  - **How to prevent recurrence**: `CLAUDE.md trigger` — for future superpowers-bridge apply work, require a named worktree or an explicit written reason before the first implementation commit.

- **`superpowers:subagent-driven-development`**
  - **What was skipped**: No subagent dispatch record is present in the change artifacts.
  - **Why this cycle**: The implementation appears as a single co-authored commit (`adde47d`) rather than a set of independent subagent task outputs.
  - **How to prevent recurrence**: `schema graph fix` — add a small apply artifact or task note that records dispatch count and task ownership when subagents are used.

- **`superpowers:requesting-code-review`**
  - **What was skipped**: No dedicated code-review artifact or review comment is present for the adapter implementation.
  - **Why this cycle**: The available evidence moves directly from implementation (`adde47d`) to follow-up cleanup (`cd77019`) and verification, with no review checkpoint file or commit.
  - **How to prevent recurrence**: `skill description tightening` — make the apply-phase checklist require a brief review-result note before marking verification complete.

- **`superpowers:finishing-a-development-branch`**
  - **What was skipped**: Branch finishing was not captured as a separate step before merge to `main`.
  - **Why this cycle**: The current branch is `main`, and the implementation commits are already on it.
  - **How to prevent recurrence**: `scope-judgment rule` — even when committing directly to `main`, record the finishing decision in `verify.md` or `retrospective.md`.

## 5. Surprises

- OpenSpec `list` reported the change as complete by task count, while `status` still showed the overall artifact graph incomplete because retrospective was missing.
- The verify template allowed a non-failing state without an explicit Overall Decision section, so the retrospective precheck passed even though the manual checklist was not filled.
- The cancelled BYOK work shared a follow-up commit with local adapter UX polish, which made the audit trail noisier.

## 6. Promote candidates -> long-term learning

- [ ] 🟡 **Treat OpenSpec task completion and artifact completion as separate gates** -> **Promote to project AGENTS.md**
  > **Why**: `openspec list --json` showed 17/17 tasks complete, but `openspec status --change local-llm-provider-adapters --json` still required `retrospective.md`.
  > **How to apply**: Before claiming a change is done, check both task count and artifact graph status.

- [ ] 🟡 **Verification files should include an explicit final decision checkbox** -> **Promote to schema**
  > **Why**: `verify.md` lacked an Overall Decision section, so retrospective precheck could only prove it was not explicitly failed.
  > **How to apply**: For every superpowers-bridge verify artifact, require PASS / PASS WITH WARNINGS / FAIL before retrospective unlocks.

- [ ] 📌 **Keep cleanup commits single-purpose near archive time** -> **Promote to memory**
  > **Why**: `cd77019` mixed local adapter UX cleanup with cancelled BYOK documentation, making range-based evidence less precise.
  > **How to apply**: When closing an OpenSpec change, split unrelated documentation or cancellation notes into their own commit.
