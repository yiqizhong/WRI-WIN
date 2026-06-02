# Retrospective: figma-extraction-perf

> Written: 2026-06-02 (after verify passed)
> Commit range: `b7d429c..a3580a7`
> Worktree: `feat/figma-extraction-perf` (not yet merged)

---

## 0. Evidence

- **Commit range**: `b7d429c..a3580a7` (8 commits)
- **Diff size**: +234 / -11 lines across 3 files
- **Tasks done**: 15/15
- **Active hours**: ~1 session (same-day, continuous)
- **Subagent dispatches**: ~12 (3 tasks × implementer + spec-reviewer + code-reviewer, plus final review)
- **New external dependencies**: none
- **Bugs encountered post-merge**: 1 — `extraction.extraction.warnings` was computed but never surfaced to callers; caught by final code review, fixed in `a3580a7`
- **OpenSpec validate state at archive**: not yet run (verify.md PASS)
- **Test coverage signal**: 97 tests passing in review-core (14 test files); 15 passing in guideline-generation tests

Commit chain:

```
b7d429c Add design spec for parallel, capped Figma text extraction (base)
87121ae feat(review-core): cap Figma text extraction at 500 nodes
22ad3fa fix(review-core): polish cap warning copy and NaN guard
c72d9f4 feat(review-core): replace sequential loop with bounded-concurrency promise pool
ffe6539 fix(review-core): restore instance-node fast-path using Map, add concurrency lower-bound
3f89c0c feat(review-core): add onProgress callback to extractFigmaTextNodesViaMcp
3952e1c feat(daemon): wire Figma extraction progress to session progressMessage
b6d7871 fix(review-core/daemon): enforce strict completed order in progress test, add intent comment
a3580a7 fix(daemon): surface extraction cap warning in guideline generation diagnostics
```

---

## 1. Wins

- [evidence: `c72d9f4`, `ffe6539`] Promise pool implementation was correct on first dispatch — race-free (atomic `i = index++`), order-preserving (indexed assignment), and handled empty-frame edge case (`Math.min(N, 0) = 0 workers`). No logic bugs discovered in review.
- [evidence: 97/97 tests] All 6 spec scenarios covered by tests; spec compliance reviewer found zero gaps across all three tasks.
- [evidence: `ffe6539`] The O(n²) `scannedFromInstances.find` from Task 1 was identified by code review and replaced with an O(1) Map in the same cycle — no performance regression shipped.
- [evidence: plan.md] Plan quality was high enough that the implementer subagents asked zero questions and returned DONE (not NEEDS_CONTEXT) on all three tasks.
- [evidence: `22ad3fa`] Quality review caught `as const` noise, "Analyzed" vs "Extracted" wording, and `Number(x) ?? default` NaN risk — all fixed in the same cycle before merge.

---

## 2. Misses

- 🟡 [painful | evidence: `a3580a7`] **Cap warning was dead-on-arrival**: `extraction.extraction.warnings` was computed correctly but never forwarded to the daemon's response `diagnostics`. The final code reviewer caught it. The fix was a one-liner (`a3580a7`), but it required a post-implementation bugfix commit — the requirement "record a non-fatal diagnostic" was only half-implemented at the extractor layer. The plan and spec should have explicitly called out the daemon wiring for warnings (not just progress).

- 📌 [nit | evidence: `b6d7871`] **Progress test used `.sort()` instead of strict order**: The Task 3 test asserted `{1,2,3}` as a set (`.sort().toEqual([1,2,3])`), which would pass even if the pool serialized all calls. Caught in code quality review and fixed (dropped `.sort()`). Indicates the implementer subagent's TDD instinct was "ensure all values present" rather than "ensure values arrive in slot order."

- 📌 [nit | evidence: spec] **Spec scenario wording diverged from implementation**: The spec says "Analyzed the first 500 of N text nodes" but the implementation uses "Extracted the first 500 of N text nodes; the rest were skipped". The implementation wording is better — the spec should have been updated before archive.

---

## 3. Plan deviations

| Plan task | What changed | Why |
|-----------|--------------|-----|
| 1.3 — "warning string" | Warning is `ConnectionDiagnostic`, not `string` | `extraction.warnings` is typed `ConnectionDiagnostic[]` in the Zod contract; plan predated reading the contract type |
| 2.1 — sequential loop body | Added `scannedById` Map fast-path for instance nodes | Code quality review (Task 2) identified that removing the `scannedFromInstances.find` fast-path caused extra MCP round-trips per instance node; restored as O(1) Map |
| 3.5 — daemon warning wiring | Added Task 4-equivalent fix as a separate commit (`a3580a7`) after final review | Plan did not include forwarding `extraction.warnings` to daemon diagnostics; only progress callback was specified |

---

## 4. Skill / workflow compliance

| Skill | Used |
|---|---|
| superpowers:brainstorming | ✓ (captured as brainstorm.md from approved design) |
| superpowers:writing-plans | ✓ (plan.md produced directly from design) |
| superpowers:using-git-worktrees | ✓ (invoked; fell back to in-place on existing branch — correct per skill logic) |
| superpowers:subagent-driven-development | ✓ (3 implementation tasks, each with implementer + spec-reviewer + code-reviewer) |
| (transitive) superpowers:test-driven-development | ✓ (all tasks used RED-GREEN pattern; implementers wrote failing tests first) |
| (transitive) superpowers:requesting-code-review | ✓ (spec reviewer + code quality reviewer dispatched per task; final opus review run) |
| superpowers:finishing-a-development-branch | ✗ (not yet invoked — PR not yet opened) |

### Deliberately Skipped Skills

- **`superpowers:finishing-a-development-branch`**
  - **What was skipped**: The full skill was not yet invoked. The PR has not been opened.
  - **Why this cycle**: The user explicitly requested the apply→verify→retro→archive→PR sequence; finishing-a-development-branch is the last step in that sequence and comes after archive (which has not yet run). This retrospective is written before the branch-finishing step by design — the schema requires retro before PR.
  - **How to prevent recurrence**: one-off — schema boundary case. The retrospective is explicitly required before PR per the schema instruction ("retrospective.md is part of this cycle's deliverables and should land in the same PR"). This ✗ will become ✓ when `superpowers:finishing-a-development-branch` is invoked after `openspec archive`.

---

## 5. Surprises

- **`warnings` field is `ConnectionDiagnostic[]`, not `string[]`**: The plan described "push a warning string" but the contract type requires a structured `{ code, severity, message }` object. This was caught immediately on dispatch (before any test was written) because the implementer read the contract. No delay — but it means the plan's type description was wrong.
- **The `scannedFromInstances.find` fast-path was load-bearing**: Removing it for simplicity (Task 2) caused silent extra MCP round trips per instance node. The code review's structural analysis surfaced this; it was not obvious from the plan or spec. The Map fast-path restoration added one commit but kept the efficiency invariant.
- **Daemon test mocks don't include `warnings` field**: Existing `guideline-generation.test.ts` mocks return bare `extraction` objects without `warnings`, causing `TypeError: extraction.extraction.warnings is not iterable`. Required `?? []` fallback. Not a real bug in production (Zod schema defaults to `[]`), but a mock fidelity gap.

---

## 6. Promote candidates → long-term learning

- [ ] 🟡 **Plan must explicitly wire diagnostic/warning outputs end-to-end, not just compute them** → **Promote to memory** (type: feedback)
  > **Why**: The cap warning (`extraction.warnings`) was correctly computed in the extractor but never forwarded to the daemon response diagnostics. The plan only specified where to compute the warning, not where to surface it to callers. Caught in final code review rather than in spec.
  > **How to apply**: When writing plan.md tasks for any "record a diagnostic" requirement, include an explicit task step for "wire the diagnostic into the caller's response/output" — don't assume surfacing is implicit.

- [ ] 📌 **TDD progress tests should assert order, not just set membership** → **Promote to memory** (type: feedback)
  > **Why**: Task 3's progress test used `.sort()` before `.toEqual([1,2,3])`, making it pass even with a serialized pool. The correct invariant is strict order (slot index determines `completed` value), not set membership.
  > **How to apply**: When writing tests for callback sequences with ordered values, default to strict equality without `.sort()`; add `.sort()` only when order is genuinely non-deterministic and explicitly document why.

- [ ] 📌 **Spec scenario wording should match implementation wording** → **One-off** (record only)
  > **Why**: Spec said "Analyzed the first 500…" but implementation used "Extracted… the rest were skipped" (better). The spec was written before the code and wasn't updated. Not generalizable enough to promote — just archive with a note.
