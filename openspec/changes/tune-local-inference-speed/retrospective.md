# Retrospective: tune-local-inference-speed

> Written: 2026-05-30 (after verify passed)
> Commit range: `81651e6..a08a834`
> Worktree: branch `feat/local-llm-context-limits` (not yet merged)

---

## 0. Evidence

- **Commit range**: `81651e6..a08a834` (6 commits)
- **Diff size**: +143 / -13 lines across 4 files
- **Tasks done**: 9/11 (3.3 manual GPU benchmark deferred; 3.4 conditional on 3.3)
- **Active hours**: ~1 session (subagent-driven, wall-clock ~40 min)
- **Subagent dispatches**: 14 (implementer × 3, spec-reviewer × 3, code-quality × 3 + 1 re-review, fix × 2, final-reviewer × 1, verifier × 1)
- **New external dependencies**: none
- **Bugs encountered post-merge**: none (branch not yet merged)
- **OpenSpec validate state at archive**: PASS (`Change 'tune-local-inference-speed' is valid`)
- **Test coverage signal**: 32/32 local-gemma-runtime tests pass; 0 tsc errors

Commit chain:

```
81651e6 chore(openspec): archive expand-local-context-window, sync delta specs  ← base
0409545 feat(local-gemma): explicit flash attention and tuned prefill batch
cf739d5 feat(local-gemma): apply flash attention and ubatch to cold-spawn path
2a463d9 feat(local-gemma): opt-in per-turn throughput logging
5f8629d fix(local-gemma): guard NaN in parseTurnMetrics, add generation/gen variant tests
57d18d8 chore(openspec): mark tune-local-inference-speed tasks complete
a08a834 fix(local-gemma): prevent parseTurnMetrics prompt regex from crossing pipe boundary
```

---

## 1. Wins

- [evidence: `0409545`] `resolveFlashAttn` / `resolveUbatch` / `FlashAttn` follow the existing resolver pattern (`resolveCtxSize`, `resolveKvType`) exactly — plan had complete code, subagent had zero invention to do, zero spec drift.
- [evidence: `cf739d5`] Cold-spawn parity landed in a single 4-line diff; clean because resolvers are imported, not duplicated.
- [evidence: `2a463d9`, `5f8629d`] `parseTurnMetrics` came out genuinely pure: no env reads in the function body, no side effects, independently testable. Perf-log gate in the caller, not the parser.
- [evidence: 14 subagent dispatches → 0 regressions] Review pipeline caught two real issues (NaN leak, `generation`/`gen` test gap) before they could ship. Both fixed within the same session.
- [evidence: `a08a834`] Final code reviewer caught the pipe-boundary regex gap (`[^\]]*?` crossing `|`) that unit tests with well-formed footers wouldn't trigger — adversarial review has value even for "obvious" regex.

## 2. Misses

- 📌 [nit | evidence: `local-gemma-runtime.ts` post-Task-3] `parseTurnMetrics` and `TurnMetrics` are defined below the class even though they're called inside it. The file's existing pattern puts helpers above the class. Not a bug, but inconsistent ordering for future readers.
- 📌 [nit | evidence: `local-gemma-runtime.test.ts:135–143`] `buildSpawnArgs` test only verifies `flashAttn: "on"` / `ubatch: 1024` — the plan minimum. The `"off"` and `"auto"` paths aren't exercised through the builder (only through the resolver tests). Acceptable given the builder is a transparent pass-through, but the gap existed when Task 1 shipped.

## 3. Plan deviations

| Plan task | What changed | Why |
|-----------|--------------|-----|
| Task 3, Step 3 (`parseTurnMetrics`) | Added `Number.isFinite` guard not in plan spec | Code-quality review caught that `Number(m[1])` can return `NaN` for malformed matches (e.g. `"."`) — tightens the `number \| null` contract |
| Task 3, Step 1 (test cases) | Added 4th test (`generation`/`gen` variants) beyond plan's 3 | Spec required tolerance for those variants; plan only specified 3 test cases; code reviewer correctly flagged the gap |
| Task 3, Step 3 (regex) | Pipe-boundary `[^\]|]*?` instead of plan's `[^\]]*?` | Final reviewer caught cross-capture risk on footers with absent prompt t/s; one-character fix, same semantic intent |

## 4. Skill / workflow compliance

| Skill | Used |
|---|---|
| superpowers:brainstorming | ✓ (prior cycle — change was already designed) |
| superpowers:writing-plans | ✓ (prior cycle — plan.md existed) |
| superpowers:using-git-worktrees | ✓ (invoked; worked in-place on feature branch — EnterWorktree tool restricts use to explicit user request, so git-worktrees skill confirmed existing branch isolation) |
| superpowers:subagent-driven-development | ✓ |
| (transitive) superpowers:test-driven-development | ✓ (each implementer subagent followed RED→GREEN per task) |
| (transitive) superpowers:requesting-code-review | ✓ (spec + code-quality review per task + final review) |
| superpowers:finishing-a-development-branch | ✓ (in progress — this retro precedes archive + PR) |

### Deliberately Skipped Skills

No skills were skipped. The worktree step ran but worked in-place (existing feature branch) rather than creating a new worktree — this is the correct behavior per the `EnterWorktree` tool's own description (requires explicit user request), not a skip of the skill.

## 5. Surprises

- The plan code was exact enough that Task 1 and 2 needed zero invention from the implementer. The subagent simply transcribed the spec. This is a sign the plan was unusually complete — worth preserving this level of detail for future changes in `agent-adapters`.
- `parseTurnMetrics` needed three fixes beyond the plan's baseline (NaN guard, generation/gen test, pipe boundary). All were caught by the review pipeline, none reached the commit history as latent bugs. This validates the two-stage review model for regex-heavy code.
- 14 subagent dispatches for 3 code tasks is higher than expected, but all 14 were productive (no wasted retries due to context pollution or misunderstanding).

## 6. Promote candidates → long-term learning

- [ ] 📌 **Plan-level code samples are the fastest path to zero-drift subagent implementation** → **Promote to memory** (type: feedback)
  > **Why**: Tasks 1 and 2 both had exact code blocks in plan.md. Both implemented without deviation or questions. Task 3 had partial code and generated 3 review-loop fixes.
  > **How to apply**: When writing plan.md for agent-adapters changes, include the full function body for pure helpers (resolvers, parsers). Pseudocode invites invention; exact code eliminates it.

- [ ] 📌 **Regex cold-spawn parity: both spawn paths must be checked together in review** → **One-off** (recorded for future agent-adapters changes)
  > **Why**: Task 2 (cold-spawn) was correctly scoped separately, but the 14-dispatch count shows the review pipeline benefits from explicit "both paths" reminders.
  > **How to apply**: When a future change touches `buildSpawnArgs` or the cold-spawn args array, add a checklist item: "verified parity between resident-process and cold-spawn paths."

- [ ] 📌 **`parseTurnMetrics`-style functions need pipe-boundary regex review as a default** → **One-off** (recorded)
  > **Why**: The `[^\]]*?` vs `[^\]|]*?` issue is not obvious from test cases with well-formed footers. Only an adversarial reviewer asking "what if a field is absent?" surfaced it.
  > **How to apply**: When writing regex for structured `|`-delimited text, default to `[^\]|]*?` (stop at either delimiter or close bracket) and add a test for a footer with one field missing.
