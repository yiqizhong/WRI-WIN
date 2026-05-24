## Why

Writer's audit pipeline currently runs LLM prompts with no grounding in any company-specific UX writing rules. Designers and content designers report that AI copy review without brand context produces generic output they do not trust. Industry research (Atlassian, Shopify Polaris, Acrolinx, Frontitude; summarized 2026-05-23) confirms three hard requirements for a guideline-grounded audit: traceable rule citations on every finding, surface-aware filtering (button rules ≠ error rules), and corpus sizes that exceed prompt budgets.

This change introduces **Guidelines** as a first-class runtime concept: a file-backed contract that lets users supply company + per-product writing rules, glossary terms, and reference prose. The daemon discovers, parses, indexes, and injects them into audit prompts with verifiable rule-id provenance on every finding.

Scope is the *runtime*: discovery, parsing, indexing, injection, traceback. We do not build authoring UI, importers beyond Markdown, or content templates in v1. Users edit `.md` files directly with any text editor. Importer and retrieval interfaces are defined now so PDF / Notion ingestion and BM25 / vector retrieval can be added later without touching the audit pipeline.

## What Changes

**Guidelines file contract**
- From: no concept of writing guidelines.
- To: `~/.writer/guidelines/` directory with `company.md` (required) + optional `products/<id>.md`. Each file is Markdown with YAML frontmatter and structured `## Rules` / `## Glossary` blocks.
- Reason: Local-first, editor-agnostic, Git-shareable; mirrors the `CLAUDE.md` model.

**Daemon discovery and parsing**
- From: daemon has no knowledge of writing rules.
- To: new `guidelines/` daemon module scans on startup and on fs-change, parses MD → typed `Guideline` objects, validates with Zod, builds an inheritance view (product inherits company rules with `inheritedFrom` mark).
- Reason: Single source of truth; survives daemon restart.

**Indexing and retrieval interfaces**
- From: n/a.
- To: `GuidelineIndex` interface with `rulesBySurface()`, `termsByLiteral()`, `searchProse()`. MVP ships `InMemoryFullScanIndex`. Interface allows future `BM25Index` and `VectorIndex` without changing callers.
- Reason: Plan for scale without paying for it now.

**Importer interface**
- From: n/a.
- To: `Importer` interface; MVP registers `MarkdownImporter` only. Future PDF / Notion / docx importers normalize their output to `.md` files in the same directory.
- Reason: Single normalization point; downstream stays format-agnostic.

**Session snapshot**
- From: audit sessions carry no rule version.
- To: sessions snapshot the parsed guideline view + content hashes at creation; re-running audit on the same session uses the snapshot.
- Reason: Reproducibility; resolves "why are findings different on the same frame".

**Audit prompt injection and finding traceback**
- From: audit prompts contain no rules; findings have no rule provenance.
- To: pipeline injects (a) structured rules filtered by surface, (b) glossary entries with literal matches in the audited text, (c) top-K prose chunks via `searchProse`. LLM response schema mandates `ruleId` or `termId` plus `evidence`; daemon drops findings whose ruleId is not in the snapshot or whose evidence quote is not present in the audited text.
- Reason: Eliminate hallucinated citations; make every finding clickable back to its source rule.

**Per-project guideline binding**
- From: n/a.
- To: `platform-store.json` records `activeGuidelineId` per project (company id or product id). Company-only audits permitted when no product is set.
- Reason: Different Figma files belong to different products; a global binding would force constant switching.

**Desktop read-only Guidelines screen**
- From: no Guidelines UI.
- To: new `GuidelinesScreen` listing discovered company + products with parse status, rule / term counts, last modified, "Reload", and "Open in editor". No CRUD.
- Reason: Visibility and trust; authoring stays in the user's text editor.

## Capabilities

### New Capabilities
- `guidelines-runtime`: file contract, parsing, indexing, retrieval, snapshot, audit-prompt injection, finding traceback validation.

### Modified Capabilities
- `review-session-storage`: sessions persist a guideline snapshot (id + content hash + parsed view).
- `local-daemon`: new `/guidelines/*` routes; audit run reads the session snapshot.
- `desktop-shell`: new `GuidelinesScreen`; project settings gain `activeGuidelineId` selector.

## Impact

- `packages/contracts` — new `Guideline`, `Rule`, `Term`, `Surface`, `Severity` Zod schemas; finding schema extended with required citation + evidence.
- `packages/storage` — extend platform store with project → guideline binding; extend session record with snapshot.
- `apps/daemon` — new `guidelines/` module (importer registry, parser, index, watcher, routes); audit pipeline modifications.
- `apps/desktop` — new `guidelines-screen.tsx`; project settings UI.
- `~/.writer/guidelines/` — new user-owned directory (scaffolded by daemon on first run).
- `docs/linear-openspec-map.md` — add new epic mapping.
- `PRODUCT.md` — update product purpose to mention guideline-grounded audit.
