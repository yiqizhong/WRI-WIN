<!-- Linear: epic WRI-103 (children WRI-104..WRI-111) -->

## 1. Contracts

- [ ] 1.1 Add `surfaceSchema` (button | error | empty-state | toast | body | title | other) and `severitySchema` (must | should | may) to `packages/contracts`.
- [ ] 1.2 Add `ruleSchema` (id, do, dont?, reason?, surfaces[], severity, inheritedFrom?, overrides?, excludes?). Reserved fields parsed but ignored in v1.
- [ ] 1.3 Add `termSchema` (id, term, status, forbidden?, forbiddenReplacement?, caseSensitive, context?, reason?, localizations?). `localizations` reserved.
- [ ] 1.4 Add `guidelineSchema` (id, name, scope: company | product, parentId?, schema: number, version, updatedAt, rules[], glossary[]).
- [ ] 1.5 Extend `findingSchema` to require `ruleId` xor `termId`, plus `evidence { quote, surface, sourceNodeId }`. Add `source: 'llm' | 'glossary'`.
- [ ] 1.6 Add `guidelineSnapshotSchema` for session embedding (guidelineId, parsed view, file content hashes, capturedAt).
- [ ] Verify: `npm run typecheck` clean; new schemas exported from package index.

## 2. Daemon — Importer + parser

- [ ] 2.1 `apps/daemon/src/guidelines/importers/index.ts` — `Importer` interface (`canHandle(filePath)`, `parse(filePath)`) + registry.
- [ ] 2.2 `markdown-importer.ts` — extract YAML frontmatter, parse `## Rules` and `## Glossary` YAML lists, retain free prose body. Return `Guideline | ParseError` with line-numbered errors.
- [ ] 2.3 Validate parsed objects against `guidelineSchema`; map Zod errors to `{ file, line, message }`.
- [ ] 2.4 Detect duplicate IDs within file and across files in the tree; refuse the entire tree on conflict.
- [ ] Verify: unit tests on fixture files (clean, broken-yaml, duplicate-id, missing-required-field).

## 3. Daemon — Discovery + watcher + cache

- [ ] 3.1 `apps/daemon/src/guidelines/discovery.ts` — locate `~/.writer/guidelines/company.md` + `products/*.md`.
- [ ] 3.2 First-run scaffold: create directory + starter `company.md` containing exactly one example rule, one example term, and inline comments explaining each field. No external authority references (Mailchimp / Polaris / Carbon / etc.) — neutral, format-teaching only.
- [ ] 3.3 `cache.ts` — in-memory map keyed by file path + content hash; persisted index header at `~/.writer/guidelines/.cache/index.json`.
- [ ] 3.4 `watcher.ts` — chokidar watch with 500ms debounce, re-parse changed files, emit `guidelines:changed` SSE event.
- [ ] 3.5 Inheritance view builder: product rules get `inheritedFrom: 'company'` for inherited entries.
- [ ] Verify: integration test simulates edit / save / reload via tmpdir HOME override.

## 4. Daemon — Index + retrieval

- [ ] 4.1 `apps/daemon/src/guidelines/index/types.ts` — `GuidelineIndex` interface (`rulesBySurface`, `termsByLiteral`, `searchProse`).
- [ ] 4.2 `full-scan-index.ts` — MVP implementation: linear scan with surface filter; case-aware literal term matching (driven by `caseSensitive`).
- [ ] 4.3 `searchProse` MVP: chunk prose body by heading + ~500-token sliding window; score by keyword overlap with the query; return top-K with stable chunk IDs (hash of filePath + headingPath + offset + content).
- [ ] 4.4 `index/registry.ts` — selects implementation by corpus size; v1 always returns `FullScan` and emits a warning event when corpus exceeds 200 rules or 50KB prose.
- [ ] Verify: unit tests cover surface exactness, literal matching with caseSensitive on/off, chunk ID stability across re-parse of identical content.

## 5. Daemon — Routes + snapshot

- [ ] 5.1 `GET /guidelines` — list `{ id, scope, version, ruleCount, termCount, parseStatus, parseError? }` plus `companyMissing` flag.
- [ ] 5.2 `GET /guidelines/:id` — full parsed view.
- [ ] 5.3 `GET /guidelines/:id/sources` — raw `.md` content for debugging / UI editor link.
- [ ] 5.4 `POST /guidelines/reload` — force rescan.
- [ ] 5.5 SSE channel publishes `guidelines:changed`.
- [ ] 5.6 `GET /guidelines/:id/snapshot` — produce a `guidelineSnapshotSchema` instance for embedding in a session.
- [ ] Verify: contract tests per route; SSE event fires on tmpdir file edit; manual `curl` flow documented.

## 6. Session storage + audit pipeline integration

- [ ] 6.1 `packages/storage` — session record adds optional `guidelineSnapshot` field.
- [ ] 6.2 `packages/storage` — `platform-store.json` adds `projects[id].activeGuidelineId`.
- [ ] 6.3 `packages/review-core` — audit prompt builder reads snapshot, injects: (a) full rules filtered by frame surface, (b) full glossary entries with literal matches, (c) top-K prose chunks via `searchProse`.
- [ ] 6.4 `packages/review-core` — finding validator: drop findings whose ruleId/termId is not in the snapshot or whose evidence quote is not in the audited text. Log drops with reason (`invalid_rule_id`, `invalid_term_id`, `evidence_not_found`). Each audit run summary persists `{ emittedCount, droppedCount, droppedByReason }`.
- [ ] 6.5 `packages/review-core` — deterministic glossary findings: literal forbidden-term matches emit findings tagged `source: 'glossary'` without invoking the LLM.
- [ ] Verify: `npm run test` covers injection shape, validator drops, deterministic glossary path.

## 7. Desktop

- [ ] 7.1 `apps/desktop/src/screens/guidelines-screen.tsx` — read-only Carbon Tile list: company + each product. Each tile: ruleCount / termCount / parseStatus / last updated.
- [ ] 7.2 Parse-error tiles show `InlineNotification` with file path + line; buttons: "Open in editor" + "Reveal in Finder" via Electron `shell`.
- [ ] 7.3 "Reload" button → `POST /guidelines/reload`.
- [ ] 7.4 Sidebar adds Guidelines route between Sources and Agents.
- [ ] 7.5 Project settings / detail panel: `activeGuidelineId` dropdown (None / company / each product).
- [ ] 7.6 Review screen: when an audit run's drop rate exceeds 20% of emitted+dropped findings, surface an `InlineNotification`: "N findings filtered — the model produced unverifiable citations. Try a stricter model or simpler rules." Below threshold, render the count silently in the run details panel.
- [ ] 7.7 Guidelines screen: render a non-blocking tile when corpus size exceeds 200 rules or 50KB prose: "Corpus near linear-scan limit. Performance may degrade past this point."
- [ ] Verify: manual desktop smoke per `verify.md`; no new privileged operations in renderer.

## 8. Documentation + map

- [ ] 8.1 README — section on Guidelines: file layout, frontmatter spec, where to edit, Reload behavior.
- [ ] 8.2 `docs/linear-openspec-map.md` — add this change with its epic.
- [ ] 8.3 `PRODUCT.md` — update product purpose to mention guideline-grounded audit.
- [ ] 8.4 Starter `company.md` template committed to `docs/templates/guidelines/company.md`.
