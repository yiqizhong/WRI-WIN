# Guidelines Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each task starts with a failing test (Red) before any implementation (Green).

**Goal:** Ship a file-backed Guidelines runtime that discovers `~/.writer/guidelines/*.md`, parses them into typed objects, injects them into audit prompts, and validates every finding's citation back to the source rule. No in-app authoring UI; users edit `.md` files directly.

**Architecture:** Contracts in `@writer/contracts`. Discovery, parsing, indexing, watching, and routing in `apps/daemon/src/guidelines/`. Snapshot embedded in session records (`@writer/storage`). Audit prompt injection and finding validation in `@writer/review-core`. Read-only desktop screen plus per-project binding selector. Importer and Index abstractions exist on day one even though only `MarkdownImporter` and `InMemoryFullScanIndex` ship.

**Tech Stack:** TypeScript ESM, Zod 4, Vitest, chokidar (fs watch), gray-matter (frontmatter), js-yaml (structured blocks), React 19 + Carbon, Electron 39 `shell` API (open in editor / reveal in Finder).

---

## File Structure

- `packages/contracts/src/guideline.ts`: surface, severity, rule, term, guideline, snapshot schemas.
- `packages/contracts/src/finding.ts`: finding schema with required citation + evidence.
- `packages/contracts/src/index.ts`: re-exports.
- `apps/daemon/src/guidelines/types.ts`: internal types (ParseError, ImporterResult, ChunkId).
- `apps/daemon/src/guidelines/importers/types.ts`: `Importer` interface + registry.
- `apps/daemon/src/guidelines/importers/markdown-importer.ts`: MD frontmatter + structured block parser.
- `apps/daemon/src/guidelines/discovery.ts`: directory scan, first-run scaffold.
- `apps/daemon/src/guidelines/cache.ts`: in-memory + on-disk header.
- `apps/daemon/src/guidelines/watcher.ts`: chokidar debounce, SSE emit.
- `apps/daemon/src/guidelines/inheritance.ts`: company → product rule merge.
- `apps/daemon/src/guidelines/index/types.ts`: `GuidelineIndex` interface.
- `apps/daemon/src/guidelines/index/full-scan-index.ts`: MVP linear scan + prose chunker.
- `apps/daemon/src/guidelines/index/registry.ts`: chooses implementation; emits corpus-size warning.
- `apps/daemon/src/guidelines/snapshot.ts`: build session snapshot object.
- `apps/daemon/src/routes/guidelines.ts`: REST + SSE endpoints.
- `apps/daemon/src/scaffold/starter-company.md`: neutral starter template (no external authority references).
- `packages/storage/src/platform-store.ts`: add `projects[id].activeGuidelineId`.
- `packages/storage/src/session-record.ts`: add optional `guidelineSnapshot`, `auditRunSummary`.
- `packages/review-core/src/prompt-builder.ts`: inject snapshot rules + glossary + retrieved prose.
- `packages/review-core/src/finding-validator.ts`: drop unverifiable citations; record summary.
- `packages/review-core/src/deterministic-glossary.ts`: literal-match findings, no LLM.
- `apps/desktop/src/screens/guidelines-screen.tsx`: read-only list view.
- `apps/desktop/src/screens/components/guideline-tile.tsx`: per-guideline card.
- `apps/desktop/src/daemon-client.ts`: `listGuidelines`, `reloadGuidelines`, `getGuidelineSources`, `subscribeGuidelinesChanged`.
- `apps/desktop/src/project-settings.tsx`: `activeGuidelineId` dropdown.
- `apps/desktop/src/screens/review-screen.tsx`: drop-rate banner (>20%).
- `docs/templates/guidelines/company.md`: shipped reference copy of the starter.
- `README.md`: Guidelines section.
- `PRODUCT.md`: product purpose update.
- `docs/linear-openspec-map.md`: epic mapping.

---

## Task 1: Contracts

- [ ] **Step 1.1 (Red):** Write `packages/contracts/src/guideline.test.ts`.
  - Cover: surface enum membership, severity enum membership, rule with all optional fields omitted, term with `forbidden` + `forbiddenReplacement` interplay, guideline with mixed rules + glossary, snapshot with file-hash map.
  - Assert rejection of: unknown surface, missing rule `id`, term with `status: 'forbidden'` and no `forbidden` array.
  - Run: `npm --workspace @writer/contracts run test -- guideline.test.ts`
  - Expected: fail (file does not exist).

- [ ] **Step 1.2:** Create `packages/contracts/src/guideline.ts`.
  - `surfaceSchema = z.enum(['button', 'error', 'empty-state', 'toast', 'body', 'title', 'other'])`.
  - `severitySchema = z.enum(['must', 'should', 'may'])`.
  - `ruleSchema`: id (kebab-case regex), do, dont?, reason?, surfaces (≥1), severity, inheritedFrom?, overrides? (reserved), excludes? (reserved).
  - `termSchema`: id, term, status (`preferred | forbidden | pending`), forbidden?, forbiddenReplacement?, caseSensitive (default false), context?, reason?, localizations? (reserved).
  - `guidelineSchema`: id, name, scope (`company | product`), parentId?, schema (number, default 1), version, updatedAt (ISO), rules[], glossary[].
  - `guidelineSnapshotSchema`: guidelineId, view (parsed Guideline), fileHashes (map: path → sha256), capturedAt.

- [ ] **Step 1.3 (Red):** Write `packages/contracts/src/finding.test.ts`.
  - Assert: finding with both `ruleId` and `termId` rejected (xor); finding with neither rejected; finding with `evidence.quote` empty rejected; valid finding accepted; `source: 'glossary'` valid.

- [ ] **Step 1.4:** Create or extend `packages/contracts/src/finding.ts`.
  - `findingSchema`: id, message, severity, citation (xor `ruleId` | `termId`), evidence `{ quote (≥1 char), surface, sourceNodeId }`, source (`'llm' | 'glossary'`, default `'llm'`).
  - `auditRunSummarySchema`: emittedCount, droppedCount, droppedByReason `{ invalid_rule_id, invalid_term_id, evidence_not_found }`, runId, sessionId.

- [ ] **Step 1.5 (Green):** Re-export from `packages/contracts/src/index.ts` and run:
  - `npm --workspace @writer/contracts run test`
  - `npm --workspace @writer/contracts run typecheck`

---

## Task 2: Markdown importer + parser

- [ ] **Step 2.1 (Red):** Write `apps/daemon/src/guidelines/importers/markdown-importer.test.ts`.
  - Fixtures under `apps/daemon/src/guidelines/__fixtures__/`: `clean.md`, `broken-yaml.md`, `duplicate-id.md`, `missing-required.md`, `unknown-surface.md`, `prose-only.md`.
  - Assert: clean fixture parses to a valid Guideline; broken-yaml returns ParseError with line number; duplicate-id returns ParseError listing both line numbers; missing-required cites the missing field; prose-only succeeds with empty rules/glossary arrays.
  - Run: `npm --workspace @writer/daemon run test -- markdown-importer.test.ts`
  - Expected: fail (importer does not exist).

- [ ] **Step 2.2:** Add daemon deps.
  - `npm install --workspace @writer/daemon gray-matter js-yaml chokidar`
  - `npm install --workspace @writer/daemon --save-dev @types/js-yaml`

- [ ] **Step 2.3:** Create `apps/daemon/src/guidelines/importers/types.ts`.
  - `Importer { id: string; canHandle(filePath): boolean; parse(filePath): Promise<ImporterResult> }`.
  - `ImporterResult = { ok: true; guideline: Guideline } | { ok: false; errors: ParseError[] }`.
  - `ParseError { file, line?, message, severity: 'error' }`.
  - `ImporterRegistry`: register, resolve, list.

- [ ] **Step 2.4:** Create `markdown-importer.ts`.
  - Read file → `gray-matter` for frontmatter + body.
  - Validate frontmatter against `guidelineSchema.omit({ rules: true, glossary: true })`.
  - Parse body: find `## Rules` and `## Glossary` headings; extract following YAML list using `js-yaml`. Track line offsets so ParseErrors carry real line numbers.
  - Per-rule and per-term Zod validation; aggregate errors rather than fail-fast.
  - Duplicate-id check within file.
  - Return `ImporterResult`.

- [ ] **Step 2.5 (Green):** Run:
  - `npm --workspace @writer/daemon run test -- markdown-importer.test.ts`
  - `npm --workspace @writer/daemon run typecheck`

---

## Task 3: Discovery + first-run scaffold + cache

- [ ] **Step 3.1 (Red):** Write `apps/daemon/src/guidelines/discovery.test.ts`.
  - Use a tmpdir HOME override (`process.env.HOME = tmp`).
  - Assert: empty HOME triggers scaffold of `~/.writer/guidelines/company.md` with non-empty content; subsequent call does not overwrite; presence of `products/*.md` returns both.
  - Assert: missing `company.md` returns `{ company: null, products: [], companyMissing: true }`.

- [ ] **Step 3.2:** Create `apps/daemon/src/scaffold/starter-company.md`.
  - YAML frontmatter (id: company, name: "Your company", schema: 1, version: 1, updatedAt).
  - Free prose body with inline comments explaining each frontmatter field.
  - `## Rules`: exactly one example rule (button sentence-case).
  - `## Glossary`: exactly one example term.
  - **No** references to Mailchimp, Polaris, Carbon, or any external authority (per D16).

- [ ] **Step 3.3:** Create `discovery.ts`.
  - Resolve `~/.writer/guidelines/`.
  - First-run: `mkdir -p` directory, write starter from `scaffold/starter-company.md`.
  - Enumerate: `company.md` + `products/*.md`.
  - Return `{ companyPath, productPaths }`.

- [ ] **Step 3.4:** Create `cache.ts`.
  - In-memory `Map<filePath, { hash, parsedAt, result }>`.
  - On-disk header at `.cache/index.json`: `{ files: [{ path, hash, parseStatus, parsedAt }] }`.
  - `get(filePath)`, `set(filePath, result)`, `invalidate(filePath)`, `snapshotHeader()`.

- [ ] **Step 3.5 (Green):**
  - `npm --workspace @writer/daemon run test -- discovery.test.ts cache.test.ts`
  - `npm --workspace @writer/daemon run typecheck`

---

## Task 4: Watcher + inheritance view

- [ ] **Step 4.1 (Red):** Write `apps/daemon/src/guidelines/watcher.test.ts`.
  - Use tmpdir + chokidar with `awaitWriteFinish` disabled for test speed.
  - Assert: edit triggers re-parse within 2s and emits a `guidelines:changed` event on an injected EventEmitter.
  - Assert: rapid sequential edits debounce to one event within 500ms.

- [ ] **Step 4.2:** Create `watcher.ts`.
  - `createGuidelinesWatcher({ rootDir, importerRegistry, cache, emit })`.
  - Watch `**/*.md` under root with 500ms debounce.
  - On change: re-import, write cache, emit event with `{ filePath, parseStatus }`.
  - Expose `start()` / `stop()`.

- [ ] **Step 4.3 (Red):** Write `apps/daemon/src/guidelines/inheritance.test.ts`.
  - Given a company with rules A, B and product with rule C, expect product view = [A (inheritedFrom: company), B (inheritedFrom: company), C].
  - Given a product where a local rule's id collides with company → return tree-level conflict error (no merge happens).

- [ ] **Step 4.4:** Create `inheritance.ts`.
  - `buildInheritanceView(company, product): Guideline | ConflictError`.
  - Clone company rules into product, tagging `inheritedFrom: 'company'`.
  - Tree-level duplicate detection across company + product.

- [ ] **Step 4.5 (Green):**
  - `npm --workspace @writer/daemon run test -- watcher.test.ts inheritance.test.ts`

---

## Task 5: Index + retrieval

- [ ] **Step 5.1 (Red):** Write `apps/daemon/src/guidelines/index/full-scan-index.test.ts`.
  - Assert `rulesBySurface('button')` returns only button-tagged rules, including inherited.
  - Assert `termsByLiteral('Login')` honors `caseSensitive: false` and false-positive substring traps (`'Login'` should not match `'iCloud Logins overview'` if `caseSensitive: true` and word-boundary intended → MVP uses simple substring; document this).
  - Assert chunk ID stability: same content parsed twice → same chunk IDs.
  - Assert `searchProse('button copy')` returns top-K=5 chunks scored by keyword overlap; deterministic ordering on ties (by `chunkId` ascending).

- [ ] **Step 5.2:** Create `index/types.ts` with `GuidelineIndex` interface and `Chunk { id, text, sourceFile, headingPath, offset }`.

- [ ] **Step 5.3:** Create `index/full-scan-index.ts`.
  - Prose chunker: split body by `##` headings, then sliding window of ~500 tokens (~2000 chars) with 100-char overlap.
  - Chunk ID = `sha256(filePath + '|' + headingPath + '|' + offset + '|' + contentHash).slice(0, 16)`.
  - Scoring: token-overlap count between query (lowercased, split on whitespace + punctuation) and chunk text; ties broken by ascending chunkId.

- [ ] **Step 5.4:** Create `index/registry.ts`.
  - Selects `FullScan` always in v1.
  - Emits a warning event `guidelines:corpus-warning` when corpus has >200 rules **or** >50 KB prose body (per D15).

- [ ] **Step 5.5 (Green):**
  - `npm --workspace @writer/daemon run test -- full-scan-index.test.ts`

---

## Task 6: Routes + snapshot

- [ ] **Step 6.1 (Red):** Write `apps/daemon/src/routes/guidelines.test.ts`.
  - Use the daemon's existing route test harness with tmpdir HOME.
  - Assert each route: `GET /guidelines`, `GET /guidelines/:id`, `GET /guidelines/:id/sources`, `POST /guidelines/reload`, `GET /guidelines/:id/snapshot`.
  - Assert SSE `guidelines:changed` event delivered to a connected client when a file changes.

- [ ] **Step 6.2:** Create `apps/daemon/src/guidelines/snapshot.ts`.
  - `buildSnapshot(guidelineId, view, sourceFiles): GuidelineSnapshot`.
  - Compute sha256 of each source file's raw contents (not parsed).

- [ ] **Step 6.3:** Create `apps/daemon/src/routes/guidelines.ts`.
  - Wire routes; reuse existing daemon SSE channel.
  - Response shapes validated by `guidelineSchema` / `guidelineSnapshotSchema`.

- [ ] **Step 6.4 (Green):**
  - `npm --workspace @writer/daemon run test -- guidelines.test.ts`
  - `npm --workspace @writer/daemon run typecheck`

---

## Task 7: Storage + session integration

- [ ] **Step 7.1 (Red):** Write `packages/storage/src/platform-store.test.ts` updates and `session-record.test.ts` updates.
  - Assert: set/get `projects[id].activeGuidelineId`; unset returns undefined.
  - Assert: persist a session with `guidelineSnapshot` round-trips through JSON serialization.
  - Assert: pre-existing session records without `guidelineSnapshot` still load (back-compat — optional field).

- [ ] **Step 7.2:** Extend `packages/storage/src/platform-store.ts`.
  - Add `activeGuidelineId?: string` to per-project record.
  - Migration: existing stores without the field continue to load.

- [ ] **Step 7.3:** Extend `packages/storage/src/session-record.ts`.
  - Add `guidelineSnapshot?: GuidelineSnapshot`.
  - Add `auditRunSummary?: AuditRunSummary`.

- [ ] **Step 7.4 (Green):**
  - `npm --workspace @writer/storage run test`
  - `npm --workspace @writer/storage run typecheck`

---

## Task 8: Review-core integration

- [ ] **Step 8.1 (Red):** Write `packages/review-core/src/prompt-builder.test.ts`.
  - Given a snapshot with rules across 3 surfaces, build prompt for surface `button` → assert only `button` and surface-agnostic-but-tagged-`button` rules appear; no `error` rules.
  - Given audited text containing `'Login'` and a forbidden term, assert the term entry appears verbatim in the prompt.
  - Given 12 prose chunks and K=5, assert exactly 5 highest-scoring chunks appear with their stable IDs.

- [ ] **Step 8.2:** Create `packages/review-core/src/prompt-builder.ts`.
  - `buildAuditPrompt({ snapshot, auditedText, surface, K = 5 })` → `{ system, user }`.
  - System prompt sections: `## Rules` (filtered by surface), `## Glossary` (literal matches), `## Reference passages` (top-K chunks with IDs).
  - Hard contract paragraph: each finding MUST include `ruleId` or `termId` and `evidence.quote` (a literal substring of audited text).

- [ ] **Step 8.3 (Red):** Write `packages/review-core/src/finding-validator.test.ts`.
  - Assert: hallucinated `ruleId` dropped with reason `invalid_rule_id`.
  - Assert: `evidence.quote` not in audited text dropped with reason `evidence_not_found`.
  - Assert: drop counts accumulated in `auditRunSummary`.

- [ ] **Step 8.4:** Create `finding-validator.ts`.
  - `validateFindings(rawFindings, snapshot, auditedText): { kept: Finding[], summary: AuditRunSummary }`.
  - Pure function; no I/O.

- [ ] **Step 8.5 (Red):** Write `packages/review-core/src/deterministic-glossary.test.ts`.
  - Given audited text `'Please Login to continue'` and a forbidden term `'Login'` with `caseSensitive: false`, expect one finding with `source: 'glossary'`, citing the term.

- [ ] **Step 8.6:** Create `deterministic-glossary.ts`.
  - `scanGlossary(auditedText, snapshot.view.glossary, surface): Finding[]`.
  - Emits findings without invoking the LLM; respects `caseSensitive`.

- [ ] **Step 8.7:** Wire into existing audit run dispatcher.
  - Load snapshot from session.
  - Run deterministic glossary scan first.
  - Build prompt with `buildAuditPrompt`.
  - Receive LLM findings.
  - Validate; persist `kept` findings + `summary`.

- [ ] **Step 8.8 (Green):**
  - `npm --workspace @writer/review-core run test`
  - `npm --workspace @writer/review-core run typecheck`

---

## Task 9: Desktop

- [ ] **Step 9.1 (Red):** Write `apps/desktop/src/screens/guidelines-screen.test.tsx` (Vitest + RTL).
  - Mock daemon client returning: 1 company (parseStatus: ok), 1 product (parseStatus: error with line 42).
  - Assert company tile shows rule + term counts; product tile shows InlineNotification with line 42; "Open in editor" button present.
  - Assert clicking "Reload" calls `daemonClient.reloadGuidelines()`.

- [ ] **Step 9.2:** Extend `apps/desktop/src/daemon-client.ts`.
  - `listGuidelines()`, `getGuideline(id)`, `getGuidelineSources(id)`, `reloadGuidelines()`, `subscribeGuidelinesChanged(cb)`.

- [ ] **Step 9.3:** Create `apps/desktop/src/screens/guidelines-screen.tsx`.
  - Use existing `WriterPageGrid` layout (narrow, equal-row-height).
  - Sections: header (Reload button + count summary), company tile, products grid.
  - Subscribe to `guidelines:changed` SSE; refresh list automatically.

- [ ] **Step 9.4:** Create `apps/desktop/src/screens/components/guideline-tile.tsx`.
  - Carbon `Tile` showing id, scope, rule/term counts, last updated, parse status.
  - Parse-error tiles: `InlineNotification` with file path + line + buttons: "Open in editor" (`shell.openPath`), "Reveal in Finder" (`shell.showItemInFolder`).

- [ ] **Step 9.5:** Add Guidelines route to sidebar.
  - Edit `apps/desktop/src/layout/sidebar.tsx` to insert between Sources and Agents.

- [ ] **Step 9.6:** Add `activeGuidelineId` selector to project settings.
  - Carbon `Dropdown` listing None / company / each product.
  - Persists via daemon platform-store API.

- [ ] **Step 9.7:** Add drop-rate banner to Review screen.
  - When latest `auditRunSummary.droppedCount / (emittedCount + droppedCount) > 0.20`, render `InlineNotification`: *"N findings filtered — the model produced unverifiable citations. Try a stricter model or simpler rules."*
  - Below threshold: render count in run details panel only (no banner).

- [ ] **Step 9.8:** Subscribe to `guidelines:corpus-warning` SSE on Guidelines screen.
  - Render non-blocking tile: *"Corpus near linear-scan limit. Performance may degrade past this point."*

- [ ] **Step 9.9 (Green):**
  - `npm --workspace @writer/desktop run test`
  - `npm --workspace @writer/desktop run typecheck`

---

## Task 10: Docs + verification

- [ ] **Step 10.1:** Update `README.md`.
  - New section: "Guidelines": where files live, frontmatter spec, structured-block syntax, Reload behavior, where to find error line numbers.
  - "Further reading" subsection with optional links (Mailchimp / Polaris / Carbon Voice / Atlassian) for users seeking external references. These live in docs, not in the scaffolded starter.

- [ ] **Step 10.2:** Update `PRODUCT.md`.
  - Product purpose: extend to "audit Figma UX copy **against user-supplied writing guidelines**, with a mandatory human gate before writeback".

- [ ] **Step 10.3:** Copy `apps/daemon/src/scaffold/starter-company.md` to `docs/templates/guidelines/company.md`.
  - Same content as the runtime scaffold; serves as reference outside Electron.

- [ ] **Step 10.4:** Update `docs/linear-openspec-map.md`.
  - Add epic and child issue mappings for this change.

- [ ] **Step 10.5:** Full verification.
  - `npm run typecheck`
  - `npm run test`
  - `openspec validate guidelines-runtime --type change --strict`
  - Run manual checklist in `verify.md` end-to-end against a real daemon + desktop instance.

---

## Plan Self-Review

- **Spec coverage:** every `## ADDED Requirement` in [spec.md](specs/guidelines-runtime/spec.md) has at least one task: discovery (Task 3), Markdown parsing + duplicate detection (Task 2), fs watch + reload (Task 4), `GuidelineIndex` (Task 5), session snapshot (Tasks 6 + 7), prompt injection (Task 8), finding validation + deterministic glossary (Task 8), per-project binding (Task 7 + 9.6), Importer abstraction (Task 2).
- **Decision coverage:** D14 (drop-rate banner) → Step 9.7; D15 (200-rule / 50KB threshold) → Steps 5.4 + 9.8; D16 (neutral starter) → Steps 3.2 + 10.1.
- **TDD discipline:** every implementation task is preceded by a failing-test step with an explicit run command and "Expected: fail" note.
- **Boundary respect:** no privileged ops in renderer (desktop only consumes daemon APIs); daemon owns all file I/O, watching, parsing, prompt building, validation.
- **Type consistency:** schemas defined once in `@writer/contracts` and reused across daemon, storage, review-core, and desktop.
- **Placeholder scan:** no TBD/TODO placeholders in implementation steps. Linear epic id is the only intentional `TBD` and lives in `tasks.md`, not here.
- **Back-compat:** Task 7 explicitly tests that pre-existing session records without `guidelineSnapshot` continue to load; platform store migration is additive.
