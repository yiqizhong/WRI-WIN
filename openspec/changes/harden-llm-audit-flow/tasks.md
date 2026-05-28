# Tasks — harden-llm-audit-flow

Order: packages/review-core (contracts-adjacent) → daemon → integration.
Each chunk is independently verifiable. TDD where a failing test can be written first.

## 1. review-core — glossary forbidden-term matching (security / crash)

- [x] 1.1 Add a failing test in `audit-stub.test.ts`: forbidden term `"C++"` (regex metacharacters) must produce a finding/rewrite without throwing.
- [x] 1.2 Add a failing test: a `caseSensitive: true` term must NOT match a different-cased occurrence on replacement.
- [x] 1.3 In `audit-stub.ts`, replace `surface.replace(new RegExp(matched, "gi"), term.term)` with an escaped, case-aware, literal-replacement helper (`replaceForbiddenLiteral` + `escapeRegExp`).
- [x] Verify: `npx vitest run packages/review-core/src/audit-stub.test.ts` green (8 passed).

## 2. review-core — parseFigmaAuditResults coverage

- [x] 2.1 New `figma-audit-prompt.test.ts`: parses clean JSON, ```json-fenced JSON, prose-wrapped JSON; returns `[]` for malformed input; coerces missing `rationale`/`changed`.
- [x] Verify: `npx vitest run packages/review-core/src/figma-audit-prompt.test.ts` green (7 passed).

## 3. daemon — honest seed / fallback rationale

- [x] 3.1 `seedReviewChangesFromExtraction`: seed rationale now "Extracted from Figma. Awaiting AI review." (neutral, audit not yet run).
- [x] 3.2 Confirmed the confident wording is only written by a completed pass (LLM `changed:false` writes the LLM rationale; stub writes the glossary rationale).
- [x] Verify: `npm run typecheck` clean for review-queue.ts (pre-existing WIP errors in tree-api.ts unrelated).

## 4. daemon — observability

- [x] 4.1 `runLlmAuditForFigma`: `console.warn` the caught error (and the no-parseable-results case) before falling back; zero-count return preserved.
- [x] 4.2 `scanInstanceTextNodes`: warn when the instance scan MCP call fails rather than silently returning `[]`. (Pure parsers `parseFigmaAuditResults`/`parseFigmaFrameTextScanResult` intentionally keep returning `[]` with no log — malformed model output is expected and unit-tested.)
- [x] Verify: review-core + daemon typecheck clean for edited files.

## 5. daemon — code hygiene + prompt-injection note

- [x] 5.1 Replaced inline `import("@writer/contracts").ThreeLayerGuidelineSnapshot` with a top-level `import type`.
- [x] 5.2 Added a trust-boundary comment at the LLM-apply site: suggestions only update `after` of existing ReviewChange records, matched by `sourceId`, human-gated before write-back.
- [x] Verify: `npm run typecheck` clean for edited files.

## 7. daemon — test hermeticity (discovered during verification)

- [x] 7.1 `integration.test.ts > runs figma audit with injected MCP client` timed out: the new LLM audit flow launches the active agent adapter, and `beforeAll`'s `refreshAgentDetection` had selected a real local CLI, so the audit invoked it and hung. Confirmed pre-existing (passes on HEAD, fails with the working-tree flow) — not caused by this change's edits.
- [x] 7.2 Fix: clear the active adapter in that test (`setActiveAdapterId(null)`) so the audit exercises its deterministic stub/seed fallback. Test now passes in ~2.8s.
- [x] Verify: `npx vitest run apps/daemon packages/review-core packages/contracts` → 204 passed.

## 6. Follow-up (deferred — not in this slice)

- [ ] 6.1 `figma-metadata-xml.ts findMatchingCloseTag` is O(n²) on deeply nested
      metadata. It is currently correct and covered by tests in
      `figma-extract-mcp.test.ts`. Rewrite to a single-pass tokenizer only if a
      real large-frame perf issue is observed. Out of scope here.

## Integration verification

- [ ] V.1 `npm run test` across workspaces green.
- [ ] V.2 `npm run typecheck` across workspaces clean.
