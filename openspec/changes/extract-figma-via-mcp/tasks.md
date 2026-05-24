# Tasks · extract-figma-via-mcp

Parent Linear epic: **WRI-98** - Figma frame review and approved writeback via MCP.

## 1. Frame extraction and persistence contracts - WRI-99

- [ ] 1.1 Restrict Figma session intake to selected `/design/` Frame URLs with `node-id`; add unsupported-source tests.
- [ ] 1.2 Extend shared diagnostics and add typed MCP/extraction/review-queue contracts.
- [ ] 1.3 Persist Frame extraction, design context, and diagnostics on `ReviewSession`; add storage reload coverage.
- [ ] 1.4 Export the new contracts and make existing daemon/desktop imports compile.

## 2. Real Frame extraction and audit input - WRI-100

- [ ] 2.1 Add an injected `FigmaMcpReader` interface and fixture-driven MCP extraction tests in `packages/review-core`.
- [ ] 2.2 Implement Frame metadata hierarchy parsing and real text-node extraction with partial-read warnings.
- [ ] 2.3 Normalize Figma sessions and replace `/figma/extract` plus `/review/context` stub behavior with MCP-backed/persisted results.
- [ ] 2.4 Replace hardcoded Figma items in `/review/audit/run` with extracted text nodes and persist diagnostics.
- [ ] 2.5 Add daemon integration coverage for real text, disconnected MCP, empty Frame, and no-stub behavior.

## 3. Permission-gated real Figma writeback - WRI-101

- [ ] 3.1 Add writeback result/diagnostic test coverage for eligible, ineligible, conflicting, and partially failed text-node updates.
- [ ] 3.2 Adapt the connected MCP client for `use_figma` text mutation while retaining daemon ownership.
- [ ] 3.3 Replace dry-run `/figma/writeback` with explicit approved/edited apply, write permission enforcement, and stale-text conflict protection.
- [ ] 3.4 Persist per-node `applied`/`failed` status and audit-log evidence; cover retryable failures in integration tests.

## 4. Desktop workflow and documentation - WRI-102

- [ ] 4.1 Surface Frame intake/extraction diagnostics with a recovery route to Figma connection setup.
- [ ] 4.2 Add `Apply approved to Figma` for approved/edited rows, including permission-required and per-node result feedback.
- [ ] 4.3 Remove bootstrap extraction/writeback limitation wording and document the selected Frame workflow in `README.md`.
- [ ] 4.4 Add this change mapping to `docs/linear-openspec-map.md`.

## 5. Verification and closure - WRI-102

- [ ] 5.1 Run `npm run typecheck` and `npm run test`, distinguishing any pre-existing baseline failure from change regressions.
- [ ] 5.2 Run `openspec validate extract-figma-via-mcp --type change --strict`.
- [ ] 5.3 Manually verify real Frame extraction, approval-without-mutation, explicit apply, disconnected recovery, and stale-text conflict.
- [ ] 5.4 Produce `verify.md` and `retrospective.md`, then archive only after all blocking evidence passes.

## Execution Notes

- Tasks execute in order: `WRI-99` -> `WRI-100` -> `WRI-101` -> `WRI-102`.
- After a task is completed and committed, update its Linear issue with state and a short comment containing the commit SHA and verification evidence.
- No implementation commit is permitted until the user explicitly authorizes commits under the repository rules.
