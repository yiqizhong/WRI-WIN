# Brainstorm — improve-robustness-and-efficiency

**Origin:** Full-codebase audit on `main` (2026-06-09), `docs/code-quality-audit-2026-06-09.md`.
Findings verified + adversarially cross-checked (this pass corrected 4 overstated items).

## Scope decision

- **Quality epic** of a two-epic split (the other is `harden-local-trust-boundaries` for
  security). Robustness + efficiency only — no security findings here.
- **LOW items kept as backlog issues.**
- **Spec deltas authored per finding at implementation time.**

## Findings in this epic

| Task | Finding | Severity | Capability | User-visible? |
|------|---------|----------|------------|---------------|
| 1 | R1 — download resume corruption (`stat(tmp)` offset + require 206) | MEDIUM | local-daemon | yes — interrupted multi-GB download restarts from scratch |
| 2 | E1 — whole-store rewrite per mutation (compact JSON + debounce) | MEDIUM | store-eviction / review-session-storage | yes — app slows as the store/audit log grows |
| 3 | E3 — 100ms run poll: raise interval + in-flight guard + dedupe | MEDIUM | renderer-polling-stability | yes — battery/CPU drain during runs |
| 4 | E2 — cache `listGpuDevices` in `detect()` (backlog) | LOW | agent-adapter-runtime | minor — brief lag opening the LLM panel |
| 5 | E4 — stream `pipeline()` for download writes (backlog) | LOW | local-daemon | no |
| 6 | R2 — surface the one fire-and-forget save error (backlog) | LOW | store-eviction | no |
| 7 | R3 — evict resident runtime on model reset (backlog) | LOW | agent-adapter-runtime | no |

## Cross-check corrections carried in (so nothing is overstated)

- **E1** recalibrated 🔴→ MEDIUM: saves fire at user-action frequency, not per-keystroke; cost
  grows to a few MB/save only once the audit log is large.
- **E2** downgraded MED→LOW: `/agents` is **not** polled (one-shot effect), so the uncached
  subprocess spawn is real waste but low-frequency.
- **R2** effectively retracted → LOW: `save()` *does* propagate to the awaited caller; only one
  fire-and-forget site (`review.ts:239`). Residual: that site + no central error surface.
