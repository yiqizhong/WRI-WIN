# Retrospective: expand-local-context-window

> Written: 2026-05-29 (after verify passed)
> Commit range: `2fa021f..ffcee9b`
> Worktree: in-place on `feat/local-llm-context-limits` (already on feature branch)

---

## 0. Evidence

- **Commit range**: `2fa021f..ffcee9b` (12 commits)
- **Diff size**: +475 / -67 lines across 10 files (8 source files + tasks.md + verify.md)
- **Tasks done**: 16/17 (task 5.4 manual smoke is a live-GPU verification, not a code task)
- **Active hours**: ~1 session (~1.5 h wall-clock)
- **Subagent dispatches**: ~31 (10 implementers + 2 reviewers each + 1 final review)
- **New external dependencies**: none
- **Bugs encountered post-merge**: none
- **OpenSpec validate state at archive**: PASS
- **Test coverage signal**: 49 vitest tests (2 daemon + 26 review-core + 21 agent-adapters); all passing

Commit chain (chronological):

```
2fa021f docs(openspec): add expand-local-context-window change
e694829 feat(local-gemma): raise manifest defaultContext to 16384
7d2b91b feat(review-core): add conservative token estimator
53546b0 feat(review-core): add token-budget sliding-window history trim
d1cd52d feat(review-core): budget conversation history by context window
224a2d9 fix(review-core): restore spec reserve constants, adjust test window
c3a6593 feat(local-gemma): extract ctx-size/KV resolvers and spawn-args builder
e78953a feat(local-gemma): add process-reuse predicate and VRAM-failure detector
fd3b6bc feat(local-gemma): session-keyed restart and FP16->q8 KV fallback
103306b feat(local-gemma): thread context size and sessionId into runtime + cold spawn
b382231 feat(daemon): pass manifest defaultContext to local Gemma adapter
009266b chore(openspec): mark expand-local-context-window tasks complete
ffcee9b docs(openspec): add verify.md for expand-local-context-window — PASS
```

---

## 1. Wins

- [commit: c3a6593–e78953a] **Extract-then-wire pattern** worked cleanly. Tasks 5–6 extracted pure helpers (resolveCtxSize, resolveKvType, buildSpawnArgs, shouldReuseProcess, isVramLoadFailure) with full unit tests; Task 7 wired them into the runtime class. This let the spec-compliance reviewers catch correctness in isolation before the stateful wiring happened, with no need to mock llama-cli.

- [commit: d1cd52d, tests: copywriter-skill.test.ts:237–250] **Two-stage review caught the constant deviation early**. Task 4's first implementation used OUTPUT_RESERVE_TOKENS=256 / SAFETY_MARGIN_TOKENS=64 to make a contextWindow=1024 test pass. The spec reviewer flagged it immediately; the fix (restore 512/256, adjust contextWindow=1500) landed in commit 224a2d9 before Task 5 began — zero rework downstream.

- [commits: e694829, b382231] **Manifest as single source of truth** threaded cleanly end-to-end: `defaultContext` changed in one place, passed through createLocalGemmaAdapter to both resident and cold-spawn paths.

- [tests: local-gemma-runtime.test.ts] **21 pure-function tests** cover all 4 key behaviors (ctx resolution, KV type selection, spawn-args shape, process-reuse predicate, VRAM-failure detection) without any process mocking — exactly the pattern the existing codebase comment recommends.

---

## 2. Misses

- 🟡 [painful | commit: 224a2d9] **plan.md's Task 4 test used contextWindow=1024 which was incompatible with spec constants.** The system prompt is ~388 tokens (~1550 chars); with reserves 512+256=768, historyBudget at 1024 was −132 (no history fits). The plan was written assuming the system prompt was ~170 tokens. The subagent had to reduce the constants to make the test pass, which spec review then caught and fixed. One extra commit and one re-review loop.

- 📌 [nit | worktrees skill] **Worktrees skill invoked but not needed.** We were already on `feat/local-llm-context-limits`. The skill correctly detected in-place branch, but the schema mandates the skill invocation even for feature branches. Minor friction — working as designed.

---

## 3. Plan deviations

| Plan task | What changed | Why |
|-----------|--------------|-----|
| Task 4, Step 1 | Test changed `contextWindow: 1024` → `contextWindow: 1500` | SYSTEM_PROMPT is ~388 tokens; spec constants (512+256=768 reserves) require contextWindow ≥ 1370 for one 252-token turn to fit |
| Task 7, Step 5 | Typecheck allowed a known failing caller in local-gemma-adapter.ts | Expected by plan; Task 8 fixed it. No deviation from intent. |

---

## 4. Skill / workflow compliance

| Skill                                            | Used |
|--------------------------------------------------|------|
| superpowers:brainstorming                        | ✓    |
| superpowers:writing-plans                        | ✓    |
| superpowers:using-git-worktrees                  | ✓    |
| superpowers:subagent-driven-development          | ✓    |
| (transitive) superpowers:test-driven-development | ✓    |
| (transitive) superpowers:requesting-code-review  | ✓    |
| superpowers:finishing-a-development-branch       | ✗    |

> **Default expectation**: all ✓. One ✗ below.

### Deliberately Skipped Skills

- **`superpowers:finishing-a-development-branch`**
  - **What was skipped**: The PR-opening step. Not skipped permanently — it is the next step in this session, immediately after retrospective.md is written.
  - **Why this cycle**: The schema requires retrospective.md to be committed to the branch before the PR is opened (so the PR diff contains the complete cycle state). This retro is being written right now. The skill will be invoked in the same session continuation.
  - **How to prevent recurrence**: No prevention needed — this is the correct ordering. The schema graph has `retrospective → (PR)`, which is exactly what happened. One-off — schema boundary case: finishing-a-development-branch is always the last step in the same session, not a skipped skill.

---

## 5. Surprises

- **System prompt token count was ~2.3× the plan estimate.** The plan assumed ~170 tokens for SYSTEM_PROMPT; the actual size is ~388 tokens (~1550 chars). This invalidated the contextWindow=1024 test case. Lesson: when a plan.md includes arithmetic that depends on token estimates of fixed strings, the estimate should be computed from the actual string length at plan-write time, not assumed.

- **`resolveCtxSize` guard `optionDefault && ...` is subtly redundant.** `optionDefault = 0` fails both the `&&` falsy check and the `> 0` check — the code is correct, but the `&&` guard suggests the author was conflating "undefined/null" with "zero". Harmless, but worth noting for future readers.

---

## 6. Promote candidates → long-term learning

- [ ] 🟡 **When plan.md contains token-budget arithmetic, compute estimates from actual string lengths at plan-write time** → **Promote to memory** (type: feedback)
  > **Why**: plan.md Task 4's contextWindow=1024 was incompatible with the spec constants because the system prompt estimate was off by 2.3×, causing one spec-compliance failure and a re-review loop (commit 224a2d9).
  > **How to apply**: When writing plan.md and it contains test cases with `contextWindow` or similar arithmetic, grep the actual constant (SYSTEM_PROMPT) and measure `Math.ceil(len/4)` before choosing the test value.

- [ ] 📌 **`resolveCtxSize` — document the `optionDefault &&` vs `> 0` redundancy as a future reader trap** → **One-off** (in-file comment acceptable; doesn't generalize)
  > **Why**: The dual guard (`optionDefault &&` + `> 0`) is correct but the `&&` is redundant since `> 0` already excludes 0. A future maintainer might misread this as "0 is a valid fallback trigger" and accidentally change the guard.
  > **How to apply**: If the function is touched again, simplify to a single `Number.isFinite(v) && v > 0` guard and drop the `&&` short-circuit.
