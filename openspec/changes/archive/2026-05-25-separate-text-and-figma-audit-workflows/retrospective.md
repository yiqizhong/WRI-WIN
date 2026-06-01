# Retrospective: separate-text-and-figma-audit-workflows

> **Branch disposition (2026-05-30):** `codex/separate-text-and-figma-audit-workflows` was archived on `main` without merge and deleted. Equivalent product work shipped via `text-copy-chat-redesign` (WRI-126) and `figma-audit-redesign` (WRI-134).

> Written: 2026-05-25 (after verify passed, before archive)
> Commit range: `7d6b8f4..dce482e`
> Worktree: `/Users/yiqizhong/.config/superpowers/worktrees/Writer/codex-separate-text-and-figma-audit-workflows`

---

## 0. Evidence

- **Commit range**: `7d6b8f4..dce482e` (6 commits before retrospective/archive)
- **Diff size**: +2483 / -282 lines across 41 files before retrospective/archive
- **Tasks done**: 15/15 (`tasks.md`)
- **Active hours**: approximately 0.4 hours from first proposal commit to verification commit
- **Subagent dispatches**: 0; this session did not expose an authorized reviewer/implementation subagent path
- **New external dependencies**: none
- **Bugs encountered post-merge**: none; branch has not been merged
- **OpenSpec validate state at archive**: pass before archive (`openspec validate --all --json`: 12/12 valid); to be re-run after archive
- **Test coverage signal**: `npm run test` passed with 178 Vitest tests across 54 test files; `npm run typecheck` passed

Commit chain:

```text
684d876 docs: propose dedicated text and figma audit workflows
28a30c4 feat: add workflow context and audit batch contracts
3374625 feat: add text guidance and figma audit batch api
1de9633 feat: add dedicated desktop workflow routes
1be58ae docs: verify dedicated workflow navigation
dce482e docs: record workflow verification evidence
```

---

## 1. Wins

- The initial decisions in `brainstorm.md` remained stable through implementation: two dedicated entry points, optional Text Product selection, and one Batch row per Figma audit session.
- Contract, daemon, and desktop changes were committed in issue order (`28a30c4`, `3374625`, `1de9633`), matching WRI-122 through WRI-124 and allowing each Linear issue to close with concrete evidence.
- Automated checks and visible renderer inspection together caught both behavior and presentation requirements: `apps/daemon/src/paste-text.test.ts`, `apps/daemon/src/integration.test.ts`, and the Text placeholder correction in `1be58ae`.
- Privileged Figma writeback stayed within the existing daemon approval boundary; verification retains the passing `apps/daemon/src/figma-writeback.test.ts` signal.

## 2. Misses

- 🟡 **painful**: Repository-wide OpenSpec validation was blocked by a pre-existing invalid delta heading in `openspec/changes/paste-text-chat-rewrite/specs/paste-text-chat/spec.md`. Commit `dce482e` contains the minimal repair required for the archive gate.
- 🟡 **painful**: The schema calls for subagent-driven implementation and reviewer dispatch, but this session did not provide an authorized subagent route. Work was completed locally with TDD, explicit verification, and browser smoke checks instead.
- 📌 **nit**: Visible inspection found the unset Product sentinel exposed as `__none__` on the Text page; `1be58ae` corrected it to user-facing copy before verification.

## 3. Plan Deviations

| Plan task | What changed | Why |
| --- | --- | --- |
| 2.3 | Batch endpoint coverage was integrated in existing daemon integration tests rather than a standalone `review-batches.test.ts` file | The existing integration harness already represented API lifecycle transitions and writeback safety with less duplication. |
| 4.2 | Added minor desktop accessibility and stale-state cleanup while updating navigation | Visible workflow inspection exposed the Product sentinel and row navigation semantics during acceptance testing. |
| Verification | Included a one-line repair outside this change's feature scope | `openspec validate --all --json` is an archive gate and failed on an invalid pre-existing active change. |

## 4. Skill / Workflow Compliance

| Skill | Used |
| --- | --- |
| `superpowers:brainstorming` | Yes - decisions captured in `brainstorm.md` |
| `superpowers:writing-plans` | Yes - implementation steps captured in `plan.md` |
| `superpowers:using-git-worktrees` | Yes - feature work isolated in this worktree |
| `superpowers:subagent-driven-development` | No - see below |
| `(transitive) superpowers:test-driven-development` | Yes - focused tests preceded/validated each functional layer |
| `(transitive) superpowers:requesting-code-review` | No - see below |
| `superpowers:finishing-a-development-branch` | Yes - initiated for post-archive verification and integration choice |

### Deliberately Skipped Skills

- **`superpowers:subagent-driven-development`**
  - **What was skipped**: Dispatching independent implementation agents for plan tasks.
  - **Why this cycle**: The active session supplied local editing/testing and Linear tools, but no authorized `Task`/subagent execution route for implementing WRI-122 through WRI-125; commits `28a30c4` through `1be58ae` therefore executed the approved issue sequence locally.
  - **How to prevent recurrence**: `schema graph fix` - permit an explicit local-execution fallback in `superpowers-bridge` when its runtime cannot expose subagent dispatch, while preserving TDD and verification gates.

- **`superpowers:requesting-code-review`**
  - **What was skipped**: Dispatching the independent code-reviewer subagent required by the skill.
  - **Why this cycle**: The same missing authorized subagent route prevented a reviewer dispatch before merge; `dce482e` instead records full test, strict specification, and visible UI inspection evidence.
  - **How to prevent recurrence**: `schema graph fix` - define an evidence-based fallback review artifact when a runtime cannot supply the reviewer subagent, and require the exception in retrospective output.

## 5. Surprises

- Repository-wide validation is affected by unrelated active changes: the feature-specific strict validation passed while `--all` was blocked by `paste-text-chat-rewrite`.
- UI smoke testing remained valuable after passing tests: it found an internal placeholder value that behavior-level tests did not surface.
- The existing daemon port was already occupied by local user state, so visible acceptance deliberately avoided replacing or mutating that data and relied on automated behavior tests for execution paths.

## 6. Promote Candidates -> Long-Term Learning

- [ ] 🟡 **Run repository-wide OpenSpec validation before final feature verification, not only at archive time.** → **Promote to project agent instructions** (`AGENTS.md`)
  > **Why**: This cycle's valid feature change was blocked late by an unrelated active change with an invalid delta heading.
  > **How to apply**: For every schema-managed feature, run `openspec validate --all --json` at baseline and again before producing `verify.md`.

- [ ] 🟡 **Specify a documented local fallback when the schema requires subagents unavailable in the active runtime.** → **Promote to schema** (`openspec/schemas/superpowers-bridge/`)
  > **Why**: This cycle satisfied TDD and verification requirements locally but could not execute the schema's subagent dispatch steps.
  > **How to apply**: When no authorized subagent tool is available, require focused test evidence, a verification report, and explicit retrospective disclosure.

- [ ] 📌 **Keep browser smoke inspection for user-facing sentinel and navigation states.** → **Promote to one-off**
  > **Why**: The `__none__` label was visible only in rendered interaction and was corrected before delivery.
  > **How to apply**: Retain the current UI acceptance step for future dedicated-workflow changes; no broader workflow rule is required yet.
