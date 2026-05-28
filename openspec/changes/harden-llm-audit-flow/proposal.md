## Why

A code review of the newly-added end-to-end LLM audit flow (stub glossary pass →
LLM Figma audit → write-back to ReviewChange records) surfaced one
crash-class security bug and several correctness / clarity gaps. These ride on
the `guidelines-runtime` slice and should be fixed before the flow is trusted on
real guideline data and real (potentially untrusted) Figma files.

The most important: forbidden glossary terms are interpolated straight into
`new RegExp(...)` in the stub audit. A perfectly legitimate term such as `C++`,
`.NET`, `Node.js`, or `(beta)` throws at runtime and takes down the entire
`runStubAudit` pass — destroying the baseline findings the LLM audit depends on.

## What Changes

**Glossary forbidden-term matching (security / crash)**
- From: `surface.replace(new RegExp(matched, "gi"), term.term)` — unescaped author input compiled as a regex; always case-insensitive.
- To: literal, escaped replacement that honors `term.caseSensitive`; replacement string is treated as a literal (no `$&`/`$1` interpretation).
- Reason: glossary `forbidden` entries are arbitrary author strings; regex metacharacters must not crash the audit or mis-match.

**Seed / fallback rationale honesty (correctness)**
- From: `seedReviewChangesFromExtraction` stamps "No rule violations detected. Automated checks found no issues with this copy." *before* the LLM runs; if the LLM is unconfigured or fails, that false "passed" claim persists.
- To: neutral pending wording until an audit actually completes; the confident "no issues" copy is only used once a pass has run.
- Reason: never report "checked and clean" for copy that was never checked.

**Silent error swallowing (observability)**
- From: `catch {}` in the LLM audit + Figma scan/parse paths discards all errors, including programming errors.
- To: keep graceful fallback, but `console.warn` the underlying cause.
- Reason: keep production debuggable without changing behavior.

**Prompt-injection defense-in-depth (security, documentation)**
- From: Figma text content is embedded verbatim in the LLM prompt with no note on trust boundaries.
- To: document that suggestions are constrained to the `after` field of existing ReviewChange records, matched by `sourceId`, and are human-gated before write-back.
- Reason: make the (already-bounded) blast radius explicit for future maintainers.

**Code hygiene**
- Replace the inline `import("@writer/contracts")` type in `runLlmAuditForFigma`'s signature with a top-level `import type`.

**Test coverage**
- Add a stub-audit case for a forbidden term containing regex metacharacters (the crash repro).
- Add a stub-audit case asserting `caseSensitive` is honored on replacement.
- Add unit tests for `parseFigmaAuditResults` (fence stripping, prose-wrapped JSON, malformed input).

## Non-goals

- Rewriting the (correct, already-tested) `findMatchingCloseTag` XML parser for
  its theoretical O(n²) behavior. Figma metadata is bounded; the rewrite carries
  regression risk that is not justified in this slice. Tracked as a follow-up in
  `tasks.md §6`.
- Any change to the LLM prompt contract, adapter wiring, or write-back gating.

## Capabilities

### Modified Capabilities
- `guidelines-runtime`: glossary forbidden-term matching is crash-safe and case-aware; finding/rewrite generation unchanged in shape.
- `local-daemon`: LLM Figma audit logs failures instead of swallowing them; seed rationale is honest about whether an audit ran.
