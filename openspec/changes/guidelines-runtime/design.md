## Context

The audit pipeline today is content-blind: prompts have no grounding in any UX writing standard. Industry research and the user's product decisions (chat 2026-05-23) converge on three hard requirements: traceable findings, surface-aware filtering, and scale-tolerant retrieval. The user has decided: name = "Guidelines"; company layer is required; MVP supports a single tree (1 company + N products); no in-app authoring in v1; extensibility (importers, retrieval strategies) is non-negotiable.

This change is a *runtime*. The platform owns the contract; the user owns the content. We mirror the `CLAUDE.md` model: a known location, a parseable format, automatic discovery, no authoring UI.

## Goals / Non-Goals

**Goals:**
- File-backed Guidelines discovered automatically from `~/.writer/guidelines/`.
- Strict YAML frontmatter + Markdown body parsing with Zod validation.
- Single inheritance model (MVP): product inherits company rules; may add new ones.
- Two-stage retrieval: structured (always full, filtered by surface) + prose (top-K, keyword-scored in MVP).
- Session snapshot for reproducibility.
- Audit findings must carry `ruleId` xor `termId` plus `evidence`; daemon validates both.
- Read-only desktop view; parse errors surfaced inline with file path + line.
- `Importer` and `GuidelineIndex` abstractions defined now even though only one implementation of each ships in v1.

**Non-Goals:**
- In-app rule / term editor (users edit `.md` directly).
- PDF / Notion / docx import (interfaces predefined; no implementation).
- Vector embeddings (`embeddings/` directory reserved; no implementation).
- Override / exclude inheritance — only `inherited + added` in v1.
- Multi-tree / multi-BU support — single `default` tree in v1.
- Rule version diffing / "previously approved now non-compliant" replay.
- Localization parsing — schema reserves the slot only.
- Remote sync / cloud storage / multi-user permissions.
- Authoring telemetry.

## Decisions

### D1: File location `~/.writer/guidelines/`

- **Choice**: All guideline files live under `~/.writer/guidelines/` alongside the existing `platform-store.json`.
- **Reason**: Consistent with `packages/storage` convention; cross-project reuse; user-owned and Git-shareable.
- **Alternative**: Per-project workspace folder — rejected because Writer audits Figma URLs and is project-folderless.

### D2: Markdown + YAML frontmatter + structured blocks

- **Choice**: Each guideline = `.md` file with YAML frontmatter (id, name, schema, version, updatedAt), free Markdown prose body, and two structured sections introduced by `## Rules` / `## Glossary` containing YAML lists.
- **Reason**: Editable in any text editor; Git-diffable; prose body becomes RAG corpus; structured blocks become typed objects.
- **Alternatives**: Pure JSON (poor authoring UX); pure prose (no stable rule IDs) — both rejected.

### D3: Required `company.md`; product files optional

- **Choice**: Daemon refuses to consider guidelines available unless `company.md` parses successfully. Product files are optional; audits may run company-only.
- **Reason**: User-decided requirement; allowing product-less audits lowers first-use friction.

### D4: Parse failure = entire file unavailable

- **Choice**: A `.md` that fails Zod validation is dropped wholesale; that guideline is unavailable until fixed. No partial-success modes.
- **Reason**: User-decided; avoids silent partial state that misleads users about coverage. UI surfaces parse error with file path + line.

### D5: Stable rule and term IDs are user-authored

- **Choice**: Each rule and term carries a user-supplied `id` (kebab-case slug). Daemon refuses to load a tree with duplicate IDs within or across files.
- **Reason**: IDs are the join key between findings and rules; auto-generated IDs would invalidate finding history on edits.
- **Alternative**: Hash-derived IDs — rejected because any edit invalidates them, breaking traceability.

### D6: Two-stage retrieval; interfaces stable

- **Choice**: `GuidelineIndex` interface with three methods (`rulesBySurface`, `termsByLiteral`, `searchProse`). MVP `InMemoryFullScanIndex` linearly scans; future `BM25Index` / `VectorIndex` plug in without changing the audit pipeline.
- **Reason**: Defers scale work until needed; locks the contract now so callers never re-write.

### D7: Importer abstraction; only Markdown in v1

- **Choice**: `Importer` interface (`canHandle`, `parse`). MVP registers `MarkdownImporter` only. Future PDF / Notion importers must emit a normalized `.md` into `guidelines/` (not in-memory only), with the original kept under `.raw/` as fallback corpus.
- **Reason**: Single normalization point; downstream parser / index / audit see only Markdown. PDF conversion is therefore a 1-way write step, hand-editable after.

### D8: Session snapshot freezes the guideline view

- **Choice**: When an audit session is created, the active guideline's parsed view + content hash + file mtimes are snapshotted into the session record. Re-running audit on the same session uses the snapshot; new sessions read latest.
- **Reason**: Reproducibility without versioning machinery.

### D9: Findings must carry citation + evidence

- **Choice**: Audit response schema mandates `{ ruleId? xor termId, evidence: { quote, surface, sourceNodeId } }`. Daemon validates: (a) the citation id exists in the session snapshot; (b) the `quote` is a substring of the audited text. Failed findings are dropped and logged.
- **Reason**: Eliminates hallucinated citations; "click finding → see rule" becomes trivial.

### D10: Per-project active guideline binding

- **Choice**: `platform-store.json` adds `projects[projectId].activeGuidelineId`. Value may be the company id or a product id; unset means no grounding.
- **Reason**: Different Figma files belong to different products; a global setting would force constant switching.

### D11: Token budget = full structured + top-K prose

- **Choice**: MVP injects all surface-matching rules + all literal-matching glossary terms (structured, low token cost) plus top-K=5 prose chunks scored by keyword overlap. Daemon config carries a default 8K input budget for guideline context.
- **Reason**: Structured data is cheap; prose is the only variable cost. K and budget are dials, not architectural commitments.

### D12: Chunk IDs derived from stable content hash

- **Choice**: Prose chunks have IDs derived from `hash(filePath + headingPath + chunkOffset + contentHash)`. Same content → same ID across re-parses.
- **Reason**: Lets future retrieval implementations (BM25, vector) keep IDs consistent so findings cited against chunks remain traceable.

### D13: Deterministic glossary findings bypass LLM

- **Choice**: When the audited text contains a literal match for a forbidden glossary term, the daemon emits a finding tagged `source: 'glossary'` without invoking the LLM.
- **Reason**: Zero-hallucination path for the cheapest, highest-confidence case; reduces LLM cost and improves recall.

### D14: Audit run records a citation drop summary; UI banner past threshold

- **Choice**: Each audit run summary records `{ emittedCount, droppedCount, droppedByReason: { invalid_rule_id, invalid_term_id, evidence_not_found } }`. When `droppedCount / (emittedCount + droppedCount) > 0.20`, the Review screen surfaces a banner: *"N findings filtered — the model produced unverifiable citations. Try a stricter model or simpler rules."*
- **Reason**: A high drop rate is the clearest signal that the LLM is ignoring the citation contract or that the prompt budget is too tight. Cost is negligible (a counter), value is high (users immediately know why fewer findings appear).
- **Alternative**: Always show the count regardless of threshold — rejected as noise on healthy runs.

### D15: FullScan → BM25 cutover threshold locked at 200 rules or 50KB prose

- **Choice**: `index/registry.ts` warns when corpus exceeds 200 rules **or** 50KB prose body. The same threshold is the future BM25 cutover trigger when that implementation lands. The warning event surfaces a non-blocking tile on the Guidelines screen: *"Corpus near linear-scan limit. Performance may degrade past this point."*
- **Reason**: Empirically, ~200 atomic rules + 50KB prose stay under 100ms total scan + ~3K tokens injected. Past that, both audit latency and prompt budget start to matter. Locking the number now lets future BM25 ship without a separate design pass.
- **Alternative**: Dynamic threshold by available memory or token budget — rejected as over-engineering for a single-user local app.

### D16: Starter `company.md` is format-teaching, not voice-prescribing

- **Choice**: The scaffolded `company.md` contains exactly one example rule, one example term, and inline comments explaining each frontmatter / structured-block field. It does **not** reference Mailchimp, Polaris, Carbon, or any external voice authority.
- **Reason**: The starter's job is to teach the file format, not to bias the user toward any particular brand voice. External references would imply endorsement and risk the user copying voice rules that contradict their actual brand. The README can list outside style guides as further reading; the starter file itself stays neutral.

## Risks / Trade-offs

- [Risk] User edits `.md` while daemon has it cached → Mitigation: fsnotify watcher invalidates cache; in-flight sessions continue with their snapshot; UI offers Reload.
- [Risk] Guideline file accidentally contains secrets → Mitigation: documentation only; no scanning in v1.
- [Risk] User's IDs collide across files → Mitigation: parser refuses to load the conflicting tree and surfaces both file paths.
- [Risk] LLM ignores citation requirement and returns no `ruleId` → Mitigation: validator drops; if the drop rate exceeds a threshold per run, surface a notification on Review screen.
- [Trade-off] No in-app editor → discoverability cost; mitigated by "Open in default editor" + scaffolded starter file.
- [Trade-off] Linear scan in MVP → fine up to ~200 rules / ~50KB prose; Guidelines screen warns past that threshold and points to roadmap (BM25 next).

## Migration Plan

- First daemon startup after this change ships: scaffold `~/.writer/guidelines/` with a starter `company.md` (sample frontmatter + one example rule + one example term). User can open and edit immediately.
- Pre-existing audit sessions carry no snapshot; they continue to run without guideline grounding (unchanged behavior). New sessions opt in by setting `activeGuidelineId` on their project.

## Open Questions

None at proposal time. Future revisits:

- Whether the 20% drop-rate threshold (D14) should be model-aware (stricter for stronger models). Revisit after first production telemetry.
- Whether the 200-rule / 50KB cutover (D15) holds for non-English corpora. Revisit when localization parsing ships.
