# OpenSpec ↔ Linear sync

**Project:** [Figma UX Copy Review v1](https://linear.app/uicb/project/figma-ux-copy-review-v1-4a213fbaf788)  
**Team:** Wri (`WRI`)  
**Active change:** `extract-figma-via-mcp`

## expand-local-context-window (OpenSpec: `openspec/changes/expand-local-context-window/`)

**Epic:** [WRI-167](https://linear.app/uicb/issue/WRI-167) — Expand local LLM context window

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| §1 (1.1–1.2) | [WRI-168](https://linear.app/uicb/issue/WRI-168) | Manifest `defaultContext` → 16384 + guard test |
| §2 (2.1–2.4) | [WRI-169](https://linear.app/uicb/issue/WRI-169) | Token-aware history trimming in review-core (spec: `paste-text-chat`) |
| §3 (3.1–3.4) | [WRI-170](https://linear.app/uicb/issue/WRI-170) | Ctx size from manifest + FP16-first KV, q8 VRAM fallback (spec: `agent-adapter-runtime`) |
| §4 (4.1–4.3) | [WRI-171](https://linear.app/uicb/issue/WRI-171) | New-chat zero-context reset via session-keyed restart (spec: `agent-adapter-runtime`) |
| §5 (5.1–5.4) | [WRI-172](https://linear.app/uicb/issue/WRI-172) | typecheck + tests + `openspec validate --strict` + manual smoke |

**Suggested order:** WRI-168 → WRI-169 → WRI-170 → WRI-171 → WRI-172 → close WRI-167

## local-gemma-resident-process (OpenSpec: `openspec/changes/local-gemma-resident-process/`)

**Epic:** [WRI-177](https://linear.app/uicb/issue/WRI-177) — Local Gemma resident process (warm model, turn serialization) — **Done**

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| §1 (1.1–1.7) + §2 (2.1–2.3) | [WRI-179](https://linear.app/uicb/issue/WRI-179) | Resident runtime module + adapter integration |
| §3 (3.1–3.5) + §4 (4.1–4.5) | [WRI-181](https://linear.app/uicb/issue/WRI-181) | Tests + verification (live: 6931 ms cold → ~2.2 s warm) |

**Branch:** `feat/local-gemma-v1`

## nvidia-gpu-only-inference (OpenSpec: `openspec/changes/nvidia-gpu-only-inference/`)

**Epic:** [WRI-178](https://linear.app/uicb/issue/WRI-178) — NVIDIA GPU-only inference for Local Gemma · _2 open tasks (2.3, 3.4 unit tests; 4.4 DLL bundling deferred)_

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| §1 (1.1–1.2) + §2 (2.1–2.3) + §3 (3.1–3.4) | [WRI-180](https://linear.app/uicb/issue/WRI-180) | Contracts + GPU detection + adapter spawn args |
| §4 (4.1–4.4) + §5 (5.1–5.3) | [WRI-182](https://linear.app/uicb/issue/WRI-182) | CUDA runtime fix + output parser |
| §6 (6.1–6.3) | [WRI-183](https://linear.app/uicb/issue/WRI-183) | Verification — 58 tok/s GPU, parser 1224 chars clean rewrite |

**Branch:** `feat/local-gemma-v1`

## add-speculative-decoding (OpenSpec: `openspec/changes/add-speculative-decoding/`)

**Epic:** [WRI-184](https://linear.app/uicb/issue/WRI-184) — Add speculative decoding to Local Gemma (Gemma 4 draft, lossless decode boost) · _depends on WRI-167 + WRI-173 (both archived)_

| OpenSpec task | Linear | Notes |
|---|---|---|
| §1 (1.1–1.3) | [WRI-185](https://linear.app/uicb/issue/WRI-185) | Contracts: optional `draftModel` field on local model manifest |
| §2 (2.1–2.3) | [WRI-186](https://linear.app/uicb/issue/WRI-186) | Storage: `speculativeDecoding` slice with migration |
| §3 (3.1–3.2, 3.4) | [WRI-187](https://linear.app/uicb/issue/WRI-187) | Daemon: `installDraftModel` action with SHA verification |
| §3 (3.3, routes) | [WRI-188](https://linear.app/uicb/issue/WRI-188) | Daemon: `POST /local-model/draft/install` + `PUT /local-model/draft/enabled` |
| §4 (4.1–4.4) | [WRI-189](https://linear.app/uicb/issue/WRI-189) | Runtime: `resolveDraftModelPath` + `buildSpawnArgs --model-draft` (resident + cold-spawn) |
| §5 (5.1–5.4) | [WRI-190](https://linear.app/uicb/issue/WRI-190) | Runtime: draft-load fallback + `DraftSettings` threading from daemon |
| §6 (6.1–6.3) | [WRI-191](https://linear.app/uicb/issue/WRI-191) | Runtime: `parseTurnMetrics` draft acceptance (optional field) |
| §7 (7.1–7.5) | [WRI-192](https://linear.app/uicb/issue/WRI-192) | Desktop: Speed boost section (install + toggle + banner) |
| §8 (8.1–8.5) | [WRI-193](https://linear.app/uicb/issue/WRI-193) | Verify: typecheck + tests + strict validate + live GPU benchmark |

**Suggested order:** WRI-185 → WRI-186 → WRI-187 → WRI-188 → WRI-189 → WRI-190 → (WRI-191, WRI-192 in parallel) → WRI-193 → close WRI-184

**Branch:** `feat/local-llm-context-limits` (continues the local-LLM work; may split off when implementation starts)

## tune-local-inference-speed (OpenSpec: `openspec/changes/tune-local-inference-speed/`)

**Epic:** [WRI-173](https://linear.app/uicb/issue/WRI-173) — Tune local LLM inference speed (Q8, no quality loss) · _blocked by WRI-167_

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| §1 (1.1–1.4) | [WRI-174](https://linear.app/uicb/issue/WRI-174) | Flash attention + prefill batch on both spawn paths (blocked by WRI-170; extends `buildSpawnArgs`) |
| §2 (2.1–2.3) | [WRI-175](https://linear.app/uicb/issue/WRI-175) | Opt-in per-turn throughput logging (`WRITER_LOCAL_PERF_LOG`) |
| §3 (3.1–3.4) | [WRI-176](https://linear.app/uicb/issue/WRI-176) | typecheck + tests + strict validate + live benchmark |

**Suggested order:** WRI-174 → WRI-175 → WRI-176 → close WRI-173 (after WRI-167 lands)

## extract-figma-via-mcp (OpenSpec: `openspec/changes/extract-figma-via-mcp/`)

**Epic:** [WRI-98](https://linear.app/uicb/issue/WRI-98) — Figma frame review and approved writeback via MCP

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| 1.1–1.4 | [WRI-99](https://linear.app/uicb/issue/WRI-99) | Contracts + `McpCaller` (Done) |
| 2.1–2.5 | [WRI-100](https://linear.app/uicb/issue/WRI-100) | MCP-backed extract + Vitest |
| 3.1–3.5 | [WRI-100](https://linear.app/uicb/issue/WRI-100) | Daemon wiring + integration test |
| 4.1–4.3 | [WRI-102](https://linear.app/uicb/issue/WRI-102) | Desktop diagnostic + README |
| 5.1–5.3 | WRI-100 / WRI-102 | Stub cleanup + mapping |
| Writeback (MCP `use_figma`) | [WRI-101](https://linear.app/uicb/issue/WRI-101) | Permission-gated apply to original text node IDs |

**Suggested order:** WRI-99 → WRI-100 → WRI-101 → WRI-102 → close WRI-98

## Agent rule (required)

After **each** OpenSpec task is checked off in `tasks.md` **and** committed:

1. Update the mapped Linear issue via MCP (`save_issue`).
2. Add a short comment via MCP (`save_comment`) with:
   - Task id (e.g. `3.4`)
   - Commit SHA (`git log -1 --format=%h`)
   - One line on what shipped / what remains

**States:** `Todo` → `In Progress` when starting · `Done` when acceptance criteria met · parent epic `WRI-1` stays `In Progress` until all children done.

## `bootstrap-local-platform` mapping

| OpenSpec task | Linear issue | Notes |
|---------------|--------------|-------|
| 1.1, 1.2 | WRI-41 (Done), WRI-9 | Repo scaffold + dev scripts |
| 1.3, 1.4 | WRI-11 | Shared `@writer/contracts` |
| 2.1–2.4 | WRI-10 | Daemon startup, `/health`, errors, platform routes |
| 3.1, 3.3 | WRI-9 | Desktop shell + daemon status UX |
| 3.2 | WRI-11 | Desktop client + contracts |
| 3.4 | WRI-1 | Folder/file ops via daemon (not WRI-12) |
| 4.1–4.4 | WRI-12 | Disk persistence + restart |
| 5.1–5.5 | WRI-2 | Agent adapter runtime |
| 6.1–6.5 | WRI-3 | Tool + MCP runtime |
| 7.1–7.4 | WRI-1 | Verification, integration smoke, Figma MCP script, README |
| M2 schemas | WRI-25 | Finding + rewrite candidate contracts |
| Figma URL | WRI-21 | `POST /figma/parse-url` + `@writer/review-core` |
| Figma extract | WRI-22 | `POST /figma/extract` stub extraction |
| Context assembler | WRI-26 | `POST /review/context` + review-core |
| Approval SM | WRI-29 | `POST /review/changes/transition` |
| Change ID gate | WRI-32 | `figma.write` requires approved changeId |
| Report schema | WRI-37 | `GET /review/reports/:sessionId` |
| Pasted text | WRI-33 | `POST /sessions/pasted-text` + desktop UI |
| Design context | WRI-23 | `captureDesignContext` in extract response |

## M2–M4 slice (batch 3)

| Area | Linear issue | Notes |
|------|--------------|-------|
| Review queue UI | WRI-30 | Desktop queue + daemon `/review/queue` |
| Bulk approval | WRI-31 | `POST /review/changes/bulk` |
| Brand voice | WRI-27 | `PATCH /projects/guidance` |
| Severity | WRI-28 | `@writer/review-core` severity helpers |
| Figma writeback | WRI-24 | `POST /figma/writeback` bootstrap |
| Spreadsheet parse | WRI-34 | `@writer/spreadsheet` + `POST /spreadsheet/parse` |
| Column mapping | WRI-35 | Header role detection + desktop import |
| MD/JSON export | WRI-38 | `/review/export/markdown` and `/json` |
| Changelog | WRI-40 | `/review/changelog` |
| Audit stub | WRI-5 | `POST /review/audit/run` |

## IBM 2× Grid compliance (desktop)

| Task | Linear issue | Notes |
|------|--------------|-------|
| Epic | [WRI-93](https://linear.app/uicb/issue/WRI-93) | IBM DL + Carbon 2× Grid across all UI |
| Foundation | [WRI-94](https://linear.app/uicb/issue/WRI-94) | `writer-grid` gutter modes, column spans, breakpoints |
| ProductChrome | [WRI-95](https://linear.app/uicb/issue/WRI-95) | Product & docs style model, max width, grid influencer |
| Screens | [WRI-96](https://linear.app/uicb/issue/WRI-96) | Review, Sources, Agents, Settings |
| Verify | [WRI-97](https://linear.app/uicb/issue/WRI-97) | typecheck + vitest |

## Batch 4 (M4 completion + desktop polish)

| Deliverable | Issue | Notes |
|-------------|-------|-------|
| Row approval + XLSX/CSV export | WRI-36 | `POST /spreadsheet/export`, `@writer/spreadsheet` export |
| PDF export | WRI-39 | `GET /review/export/html` + Electron `printToPDF` |
| Light Edit epic | WRI-7 | Parent closes when WRI-36 + children done |
| Reports epic | WRI-8 | Parent closes when WRI-39 + children done |
| Save dialog exports | WRI-42 | MD/JSON/PDF via `pickSaveFile` |
| Changelog panel | WRI-43 | Desktop `ChangelogPanel` |
| Column remap UI | WRI-44 | `SpreadsheetMappingPanel` before session |
| Agents/MCP settings | WRI-45 | `AgentsPanel` + `/agents`, `/mcp/servers` |
| Figma session from URL | WRI-46 | `POST /sessions/figma` |
| Edit before approve | WRI-47 | Queue inline edit → `edited` transition |

**Parent:** WRI-1 — Platform Foundation (epic for M1)

**Milestone:** M0 = WRI-41 · M1 = WRI-1 subtree

## local-llm-provider-adapters (OpenSpec: `openspec/changes/local-llm-provider-adapters/`)

**Epic:** [WRI-48](https://linear.app/uicb/issue/WRI-48) — Local LLM providers (Cursor, Codex, Claude, Devin)

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| 1.1–1.3 | WRI-49 | CLI runner + contracts + registry |
| 2.1 | WRI-51 | Claude Code adapter |
| 2.2 | WRI-50 | Codex adapter |
| 2.3 | WRI-52 | Cursor Agent adapter |
| 2.4 | WRI-53 | Devin hybrid adapter |
| 2.5 | WRI-54 | Adapter fixture tests |
| 3.1–3.2 | WRI-55 | `/agents/detect`, `/agents/smoke` |
| 3.3–3.4 | WRI-56 | Integration tests + README |
| 4.1–4.3 | WRI-57 | Desktop connection UX |
| 5.1–5.2 | WRI-58 | Verification + CI green |

**Suggested order:** WRI-49 → WRI-50/51/52/53 (parallel) → WRI-54 → WRI-55 → WRI-56 → WRI-57 → WRI-58 → close WRI-48

**Decision:** User chose **A** — all four providers; Devin = hybrid (cloud-backed label).

## llm-byok-direct-connect (cancelled)

BYOK / Direct API removed per product decision — CLI adapters only (WRI-48). OpenSpec folder retained for history; epic WRI-59 cancelled.

## harden-local-cli-figma-mcp-connections

**Epic:** [WRI-66](https://linear.app/uicb/issue/WRI-66) — Connection hardening: local CLI LLM and Figma MCP

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| 1.1–1.3 | WRI-67 | Shared connection diagnostics contracts |
| 2.1–2.4 | WRI-68 | Local CLI LLM detection and smoke diagnostics |
| 3.1–3.5 | WRI-69 | Real Figma MCP client lifecycle and read smoke |
| 4.1–4.3 | WRI-70 | Desktop Agents/MCP diagnostic UI |
| 5.1–5.4 | WRI-71 | Mapping, README, verify.md, final verification |

## Comment template

```markdown
OpenSpec `bootstrap-local-platform` task **X.Y** done.

- Commit: `<sha>` — <one-line summary>
- Verified: `npm run typecheck` / `npm test` (if run)
```

## writer-carbon-ui-innovation (archived: `openspec/changes/archive/2026-05-22-writer-carbon-ui-innovation/`)

**Epic:** [WRI-72](https://linear.app/uicb/issue/WRI-72) — Writer Carbon UI innovation (pipeline run) — **Done**

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| 0.1 | WRI-73 | Brief validation + artifacts scaffold |
| 0.2 | WRI-74 | `@carbon/react` deps + token bridge |
| 1.1 | WRI-75 | Planner 3-pass → `TaskBreakdown.md` |
| 1.2 | WRI-76 | `gate1.html` + designer gate |
| 2.1 | WRI-77 | Architect `design-decisions.md` + inventory |
| 2.2 | WRI-78 | Carbon skeletons + ProductChrome |
| 2.3 | WRI-79 | Architect Pass 2–3 + completeness |
| 3.1 | WRI-80 | Builder shell + routing |
| 3.2 | WRI-81 | Review + Sources screens |
| 3.3 | WRI-82 | Agents/MCP + Settings |
| 4.1 | WRI-83 | Verify typecheck + Playwright |

**Verify:** `verify.md` + `artifacts/verify/*.png` · smoke: `apps/desktop/scripts/smoke-ui.sh`

- Commit: `20b30dd` — Carbon UI shell with routed screens (WRI-72 epic closed)
- Follow-up: `482433c` — SideNav in-flow layout (no content overlap)
- Follow-up: `de83d6b` — Agents runtime cached in workspace (providers stay visible; no per-visit reload)

## paste-text-chat-rewrite (OpenSpec: `openspec/changes/paste-text-chat-rewrite/`)

**Epic:** [WRI-84](https://linear.app/uicb/issue/WRI-84) — Paste Text Chat Rewrite

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| 1.1–1.6 | WRI-85 | Backend API + agent orchestration + daemon client |
| 2.1–2.4 | WRI-86 | Copywriter Skill system prompt |
| 3.1–3.5 | WRI-87 | Spreadsheet/file attachments |
| 4.1–4.6 | WRI-88 | Chat UI on Sources (no new section) |

**Suggested order:** WRI-85 → WRI-86 → WRI-87 → WRI-88 → close WRI-84

## paste-text-send-latency (OpenSpec: `openspec/changes/paste-text-send-latency/`)

**Epic:** [WRI-89](https://linear.app/uicb/issue/WRI-89) — Paste Text send latency and async UX

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| Diagnosis | WRI-90 | Sync LLM block on send — not connection latency |
| Async API | WRI-91 | Pending message + background agent run |
| Optimistic UI | WRI-92 | Poll conversation until rewrite completes |

**Suggested order:** WRI-90 → WRI-91 → WRI-92 → close WRI-89

## extract-figma-via-mcp (OpenSpec: `openspec/changes/extract-figma-via-mcp/`)

**Epic:** [WRI-98](https://linear.app/uicb/issue/WRI-98) - Figma frame review and approved writeback via MCP

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| 1.1-1.4 | WRI-99 | Frame-only intake, shared extraction/diagnostic contracts, persisted session data |
| 2.1-2.5 | WRI-100 | Real Frame text extraction and audit input through Figma MCP |
| 3.1-3.4 | WRI-101 | Explicit, permission-gated `use_figma` writeback with conflict protection |
| 4.1-5.4 | WRI-102 | Desktop apply workflow, docs, end-to-end evidence, verify/retrospective |

**Confirmed scope:** selected Figma `/design/` Frame URL only; approval/edit is separate from the explicit `Apply approved to Figma` mutation step.

**Suggested order:** WRI-99 -> WRI-100 -> WRI-101 -> WRI-102 -> close WRI-98

## guidelines-runtime (OpenSpec: `openspec/changes/guidelines-runtime/`)

**Epic:** [WRI-103](https://linear.app/uicb/issue/WRI-103) — Guidelines Runtime: file-backed UX writing guidelines with traceable audit findings

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| 1.1–1.6 | [WRI-104](https://linear.app/uicb/issue/WRI-104) | Contracts: `Guideline`, `Rule`, `Term`, `Finding` (citation + evidence), `Snapshot`, `AuditRunSummary` |
| 2.1–2.5 | [WRI-105](https://linear.app/uicb/issue/WRI-105) | Markdown importer + parser (gray-matter + js-yaml); line-numbered errors; duplicate-id detection |
| 3.1–3.5 | [WRI-106](https://linear.app/uicb/issue/WRI-106) | Discovery + first-run scaffold (neutral starter `company.md`, no external authority refs — D16) + cache |
| 3.4 + inheritance | [WRI-107](https://linear.app/uicb/issue/WRI-107) | Chokidar watcher (500ms debounce, SSE) + product→company inheritance view |
| 4.1–4.4 | [WRI-108](https://linear.app/uicb/issue/WRI-108) | `GuidelineIndex` interface + `InMemoryFullScanIndex`; corpus warning ≥200 rules / 50KB (D15) |
| 5.1–5.6 | [WRI-109](https://linear.app/uicb/issue/WRI-109) | REST routes + SSE channel + `buildSnapshot()` |
| 6.1–6.5 | [WRI-110](https://linear.app/uicb/issue/WRI-110) | Storage snapshot persistence + per-project `activeGuidelineId`; prompt injection; finding validator; deterministic glossary |
| 7.1–7.7 + 8.1–8.4 | [WRI-111](https://linear.app/uicb/issue/WRI-111) | Desktop Guidelines screen + project binding + drop-rate banner (D14) + corpus warning tile; README + PRODUCT + map |

**Suggested order:** WRI-104 → WRI-105 → WRI-106 → WRI-107 → WRI-108 → WRI-109 → WRI-110 → WRI-111 → close WRI-103

**Locked decisions (design.md):** name = Guidelines; `company.md` required, products optional; single tree v1; inheritance = inherited+added only; `Importer` + `Index` interfaces stable; findings must carry citation + evidence with daemon validation; per-project binding; session snapshot for reproducibility.

## guidelines-3-layer-refactor (planning)

**Epic:** [WRI-112](https://linear.app/uicb/issue/WRI-112) — Guidelines 3-layer hierarchy refactor

Replaces the flat company+product model from WRI-103 with a 3-layer structure that matches real team workflows: brand voice (company-base), UX writing rules (software-writing), and per-product packages (background + glossary + optional writing-guide).

| Layer | File path | Owner | Frequency |
|-------|-----------|-------|-----------|
| Company Base | `~/.writer/guidelines/company-base.md` | Brand/Marketing | years |
| Software Writing | `~/.writer/guidelines/software-writing.md` | UX Writing Lead | quarterly |
| Company Glossary | `~/.writer/guidelines/company-glossary.{csv,md}` | UX Writing Lead | ongoing |
| Product Background | `~/.writer/guidelines/products/<id>/background.md` | PM | per iteration |
| Product Glossary | `~/.writer/guidelines/products/<id>/glossary.{csv,md}` | Product team | ongoing |
| Product Writing Guide | `~/.writer/guidelines/products/<id>/writing-guide.md` | Product + UX Writer | ad hoc |

| Sub-task | Linear | Notes |
|----------|--------|-------|
| Contracts: layer + product background + product package schemas | [WRI-113](https://linear.app/uicb/issue/WRI-113) | Replaces `scope` with `layer`; adds `productBackgroundSchema`, `productPackageSchema` |
| Daemon: rewrite discovery for new layout | [WRI-114](https://linear.app/uicb/issue/WRI-114) | Scans `products/<id>/` subdirs; first-run scaffold creates empty structure (no example) |
| Daemon: file writer for new paths | [WRI-115](https://linear.app/uicb/issue/WRI-115) | createProduct, writeProductBackground/Glossary/WritingGuide, delete by kind |
| Daemon: REST routes for 3-layer slots | [WRI-116](https://linear.app/uicb/issue/WRI-116) | /company-base, /software-writing, /company-glossary, /products/:id/{background,glossary,writing-guide} |
| Storage: activeProductId per project | [WRI-117](https://linear.app/uicb/issue/WRI-117) | Replaces `activeGuidelineId`; old field silently dropped on load |
| Review-core: prompt assembly for 3-layer merge | [WRI-118](https://linear.app/uicb/issue/WRI-118) | Brand voice + software rules + product context (audience/env/purpose) + merged glossary + product rules |
| Desktop: GuidelinesScreen rewrite (4 sections) | [WRI-119](https://linear.app/uicb/issue/WRI-119) | Company Base / Software Writing / Company Glossary / Products (expandable cards) |
| Templates + Docs | [WRI-120](https://linear.app/uicb/issue/WRI-120) | 5 file templates + README + PRODUCT.md updates |

**Locked decisions:**
- D17: Software Writing layer is a single fixed slot (no mobile/web parallel variants in v1)
- D18: Product Background frontmatter requires 3 fields: `audience`, `environment`, `purpose`
- D19: Project is early — wipe `~/.writer/guidelines/` and restart, no migration logic

**Suggested order:** WRI-113 → (WRI-114, WRI-115, WRI-117 in parallel) → (WRI-116, WRI-118 in parallel) → (WRI-119, WRI-120 in parallel) → close WRI-112

## text-copy-chat-redesign (OpenSpec: `openspec/changes/text-copy-chat-redesign/`)

**Epic:** [WRI-126](https://linear.app/uicb/issue/WRI-126) — Text Copy Chat Redesign (v2 UX + three-layer guideline injection)

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| 1.1–1.4 | [WRI-127](https://linear.app/uicb/issue/WRI-127) | Contracts: `productId` + `guidelineSnapshot` on `PasteTextConversation` |
| 2.1–2.5 | [WRI-128](https://linear.app/uicb/issue/WRI-128) | Daemon snapshot resolution + create validation |
| 3.1–3.6 | [WRI-129](https://linear.app/uicb/issue/WRI-129) | Copywriter Skill three-layer prompt injection |
| 4.1–4.3 | [WRI-130](https://linear.app/uicb/issue/WRI-130) | Back-compat in-Settings paste-text Card |
| 5.1–5.11 | [WRI-131](https://linear.app/uicb/issue/WRI-131) | Desktop `TextCopyScreen` + picker + ribbon + plus-menu |
| 6.1–6.8 | [WRI-132](https://linear.app/uicb/issue/WRI-132) | End-to-end manual verification |
| 7.1–7.4 | [WRI-133](https://linear.app/uicb/issue/WRI-133) | Docs + Linear sync + archive |

**Suggested order:** WRI-127 → WRI-128 → WRI-129 → WRI-130 → WRI-131 → WRI-132 → WRI-133 → close WRI-126

**Planning commit:** `5940191` — OpenSpec proposal (`docs(openspec): draft text-copy-chat-redesign change`)

**Implementation status (2026-05-25):**

| Issue | Commit | Status |
|-------|--------|--------|
| WRI-127..WRI-131 | `07d62e7` | Done (contracts, daemon, skill, back-compat, desktop) |
| WRI-132 | `07d62e7` | Done (manual E2E sign-off) |
| WRI-133 | `07d62e7` | Done (PRODUCT.md, verify, archive, main specs) |

Epic **WRI-126** closed · archived `openspec/changes/archive/2026-05-25-text-copy-chat-redesign/`

## paste-text-chat-runtime-shell (OpenSpec: `openspec/changes/paste-text-chat-runtime-shell/`)

**Epic:** [WRI-145](https://linear.app/uicb/issue/WRI-145) — Chat runtime shell (welcome center → active bottom dock)

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| 1.1–1.3 | [WRI-146](https://linear.app/uicb/issue/WRI-146) | Runtime primitives: phase, optimistic merge, run sync tests |
| 2.1–2.3 | [WRI-147](https://linear.app/uicb/issue/WRI-147) | Hook + `ChatShellView`: optimistic send and welcome/active layouts |
| 3.1–3.2 | [WRI-148](https://linear.app/uicb/issue/WRI-148) | Viewport flex regression guard and composer bottom anchor |
| 4.1–4.3, 5.5–5.6 | [WRI-149](https://linear.app/uicb/issue/WRI-149) | Automated/manual verification, OpenSpec validate, map updates |
| 5.1 (transition), 5.2, 5.4 (first send) | [WRI-154](https://linear.app/uicb/issue/WRI-154) | Persistent Composer FLIP migration, message entrance, reduced-motion transition |
| 5.1 (sizing), 5.3, 5.4 (resize/scroll) | [WRI-155](https://linear.app/uicb/issue/WRI-155) | Animated 1–5 line input height, internal overflow, scroll stability |

**Motion decisions (confirmed 2026-05-25):**
- First send uses continuous migration of one retained Composer (`~240ms`), rather than swapping centered and docked inputs.
- Multiline input uses responsive non-bouncing growth/shrink (`~150ms`) between 1 and 5 visible lines, then internal scrolling.
- Reduced-motion mode suppresses interpolation while retaining layout, focus, optimistic send, and streaming behavior.

**Suggested order for remaining motion increment:** WRI-154 → WRI-155 → WRI-149 → close WRI-145.

**Branch disposition (2026-05-30):** Prototype branch `codex/chat-motion-polish` (`6f2c43b`, `74b82ee`) archived without merge. See `openspec/changes/archive/2026-05-30-chat-motion-polish/retrospective.md`. Production motion lives on `main` via WRI-154/WRI-155 (`composer-welcome-send-motion.ts`, expanded `ChatShellView`).

## figma-audit-redesign (OpenSpec: `openspec/changes/figma-audit-redesign/`)

**Epic:** [WRI-134](https://linear.app/uicb/issue/WRI-134) — Figma Audit Redesign (v2 UX + audit log + workflow modes + screenshots + writeback flow)

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| 1.1–1.5 | [WRI-135](https://linear.app/uicb/issue/WRI-135) | Contracts: session intent + list-page-frames |
| 2.1–2.5 | [WRI-136](https://linear.app/uicb/issue/WRI-136) | Daemon list-page-frames + direction detection |
| 3.1–3.5 | [WRI-137](https://linear.app/uicb/issue/WRI-137) | Session intent + screenshot capture |
| 4.1–4.5 | [WRI-138](https://linear.app/uicb/issue/WRI-138) | Copywriter feature context |
| 5.1–5.5 | [WRI-139](https://linear.app/uicb/issue/WRI-139) | Writeback report + skip + retry |
| 6.1–6.9 | [WRI-140](https://linear.app/uicb/issue/WRI-140) | FigmaAuditScreen + workflow tabs |
| 7.1–7.5 | [WRI-141](https://linear.app/uicb/issue/WRI-141) | `/audits` list |
| 8.1–8.8, 9.1–9.3 | [WRI-142](https://linear.app/uicb/issue/WRI-142) | Audit detail + writeback + `/review` deprecation |
| 10.1–10.9 | [WRI-143](https://linear.app/uicb/issue/WRI-143) | Manual E2E verification |
| 11.1–11.4 | [WRI-144](https://linear.app/uicb/issue/WRI-144) | Docs + Linear sync + archive |

**Suggested order:** WRI-135 → WRI-136 → WRI-137 → (WRI-138, WRI-139) → WRI-140 → WRI-141 → WRI-142 → WRI-143 → WRI-144 → close WRI-134

**Implementation status (2026-05-25):**

| Issue | Commit | Status |
|-------|--------|--------|
| WRI-135..WRI-142 | `ccffdfd` | Done (contracts, daemon, review-core, desktop) |
| WRI-143 | `ccffdfd` | Done (automated + dev smoke; see `verify.md`) |
| WRI-144 | `ccffdfd` | Done (PRODUCT.md, linear map, verify, archive) |

**Implementation status (`feat/guidelines-runtime`, 2026-05-24):**

| Issue | Commit | Status |
|-------|--------|--------|
| WRI-113 | `977ce49` | Done |
| WRI-114 | `ba26496` | Done |
| WRI-115 | `ad28181` | Done |
| WRI-116 | `cd4cff8` | Done |
| WRI-117 | `bd294ef` | Done |
| WRI-118 | `123fb18` | Done |
| WRI-119 | `3ac95a0` | Done |
| WRI-120 | `a8c00bf` | Done |

**Note:** WRI-103 ~ WRI-111 stay Done as the v1 implementation; WRI-112 supersedes that data model.

## platform-store-eviction (OpenSpec: `openspec/changes/platform-store-eviction/`)

**Epic:** [WRI-150](https://linear.app/uicb/issue/WRI-150) — Daemon memory leak — platform-store-eviction

Root cause: `PlatformStore` accumulates unbounded data (agentRunEvents, auditLog, spreadsheet parseResult, agentRun prompt) with no eviction, cap, or pruning. Investigated on branch `investigate/electron-memory-leaks` (2026-05-25).

| OpenSpec task | Linear | Notes |
|---|---|---|
| 1.1 + §3 | [WRI-151](https://linear.app/uicb/issue/WRI-151) | Move spreadsheet parseResult to disk; contracts + daemon + store migration |
| 1.2 + §2 + §4 | [WRI-152](https://linear.app/uicb/issue/WRI-152) | Store eviction: purgeAgentRunEvents, auditLog cap, stop storing prompt |
| §5 | [WRI-153](https://linear.app/uicb/issue/WRI-153) | Renderer: stabilise onConversationChange with useCallback |

**Suggested order:** WRI-151 → WRI-152 → WRI-153 → close WRI-150

## separate-text-and-figma-audit-workflows (archived OpenSpec: `openspec/changes/archive/2026-05-25-separate-text-and-figma-audit-workflows/`)

**Epic:** [WRI-121](https://linear.app/uicb/issue/WRI-121) — Dedicated Text and Figma Audit workflow entrances

**Status (2026-05-30):** Branch `codex/separate-text-and-figma-audit-workflows` archived **without merge**. Product goals were superseded on `main` by [WRI-126](https://linear.app/uicb/issue/WRI-126) (`/text-copy`) and [WRI-134](https://linear.app/uicb/issue/WRI-134) (`/figma-audit`, `/audits`). OpenSpec artifacts preserved for history only.

Separates the two home-screen jobs without replacing their implemented engines: Text reuses the conversation/attachment flow with mandatory global and optional Product guideline context; Figma Audit reuses review/writeback safety through a Batch Log and independent Detail route.

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| 1.1–1.3 | [WRI-122](https://linear.app/uicb/issue/WRI-122) | Optional Text Product contract + batch-level Audit Log contracts and persistence |
| 2.1–2.4 | [WRI-123](https://linear.app/uicb/issue/WRI-123) | Daemon guideline context, Audit Log API, failed-batch retention, existing writeback safety |
| 3.1–3.5 | [WRI-124](https://linear.app/uicb/issue/WRI-124) | `/text`, `/figma-audit`, Audit Detail routes; Settings keeps Guidelines and Agents only |
| 4.1–4.3 | [WRI-125](https://linear.app/uicb/issue/WRI-125) | Documentation, automated verification, manual flow evidence, `/opsx:verify` |

**Dependencies:** Builds on completed [WRI-84](https://linear.app/uicb/issue/WRI-84), [WRI-98](https://linear.app/uicb/issue/WRI-98), and [WRI-112](https://linear.app/uicb/issue/WRI-112).

**Branch order (historical):** WRI-122 → WRI-123 → WRI-124 → WRI-125 → close WRI-121

## enhance-figma-guideline-generation-quality (planned in Linear)

**Epic:** [WRI-202](https://linear.app/uicb/issue/WRI-202) — Figma Guideline Generation Quality Upgrade

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| 1.1–1.4 | [WRI-203](https://linear.app/uicb/issue/WRI-203) | Shared contracts: semantic analysis + Devin settings |
| 2.1–2.5 | [WRI-204](https://linear.app/uicb/issue/WRI-204) | Persisted Devin model/reasoning settings + daemon APIs |
| 3.1–3.4 | [WRI-205](https://linear.app/uicb/issue/WRI-205) | Desktop controls for Devin model/reasoning |
| 4.1–4.4 | [WRI-206](https://linear.app/uicb/issue/WRI-206) | 500-sample candidate package assembly |
| 5.1–5.5 | [WRI-207](https://linear.app/uicb/issue/WRI-207) | LLM semantic analysis stage |
| 6.1–6.4 | [WRI-208](https://linear.app/uicb/issue/WRI-208) | Evidence-grounded generation + enriched summary |
| 7.1–7.2 | [WRI-209](https://linear.app/uicb/issue/WRI-209) | Desktop diagnostics |
| 8.1–8.5 | [WRI-210](https://linear.app/uicb/issue/WRI-210) | Verification + docs |

**Suggested order:** WRI-203 → WRI-204 → WRI-205 → WRI-206 → WRI-207 → WRI-208 → WRI-209 → WRI-210 → close WRI-202

## vram-based-quant-selection (OpenSpec: `openspec/changes/vram-based-quant-selection/`)

**Epic:** [WRI-212](https://linear.app/uicb/issue/WRI-212) — VRAM-based local model quantization selection

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| §1 (1.1–1.2) | [WRI-213](https://linear.app/uicb/issue/WRI-213) | Q4_K_M manifest constant + tests |
| §2 (2.1–2.3) | [WRI-214](https://linear.app/uicb/issue/WRI-214) | detectNvidiaVram() + VRAM line parser + cache |
| §3 (3.1–3.2) | [WRI-215](https://linear.app/uicb/issue/WRI-215) | resolveLocalModelManifest() pure function + tests |
| §4 (4.1–4.3) | [WRI-216](https://linear.app/uicb/issue/WRI-216) | Daemon model layer wiring + blockedReason contract |
| §5 (5.1–5.2) | [WRI-217](https://linear.app/uicb/issue/WRI-217) | UI: selected quant size + blocked state message |
| §6 (6.1–6.3) | — | Verification: typecheck + tests + openspec validate |

**Suggested order:** WRI-213 → WRI-214 → WRI-215 → WRI-216 → WRI-217 → verification → close WRI-212

**Branch:** `feat/vram-based-quant-selection`

## figma-extraction-perf (OpenSpec: `openspec/changes/figma-extraction-perf/`)

**Epic:** [WRI-218](https://linear.app/uicb/issue/WRI-218) — Parallelize + cap Figma text extraction with live progress

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| §1 (1.1–1.4) | [WRI-219](https://linear.app/uicb/issue/WRI-219) | Cap reads at 500 nodes; non-fatal diagnostic when truncated |
| §2 (2.1–2.4) | [WRI-220](https://linear.app/uicb/issue/WRI-220) | Replace sequential loop with bounded-concurrency pool (8 workers, original order) |
| §3 (3.1–3.5) | [WRI-221](https://linear.app/uicb/issue/WRI-221) | Thread `onProgress` callback → daemon `progressMessage` (throttled 1/s) |
| §4 (4.1–4.2) | [WRI-222](https://linear.app/uicb/issue/WRI-222) | Typecheck + regression gate |

**Suggested order:** WRI-219 → WRI-220 → WRI-221 → WRI-222 → close WRI-218

**Branch:** `feat/figma-extraction-perf`

## add-windows-auto-update-r2 (OpenSpec: `openspec/changes/add-windows-auto-update-r2/`)

**Epic:** [WRI-223](https://linear.app/uicb/issue/WRI-223) — Add Windows Electron auto-update via Cloudflare R2

Thin PoC slice: `electron-updater` + NSIS + `generic` provider → R2. Auto-check on launch (packaged only), manual download + manual restart. Hard invariant: updates must not touch user data, logs, or local models under `~/.writer`.

| OpenSpec task | Linear | Notes |
|---------------|--------|-------|
| §1 (1.1–1.7) | [WRI-224](https://linear.app/uicb/issue/WRI-224) | Contracts: `AppUpdateState` Zod discriminated union (spec: `desktop-auto-update`) |
| §2 (2.1–2.5) | [WRI-225](https://linear.app/uicb/issue/WRI-225) | NSIS `generic` R2 publish config + `electron-updater` + `deleteAppDataOnUninstall:false` + upload runbook |
| §3 (3.1–3.7) | [WRI-226](https://linear.app/uicb/issue/WRI-226) | Pure event→state mapper + `app.isPackaged`-guarded updater module + IPC; wired into `main.cjs` |
| §4 (4.1–4.3) | [WRI-227](https://linear.app/uicb/issue/WRI-227) | Preload `window.writerUpdate` bridge + `writer-desktop.d.ts` typing |
| §5 (5.1–5.7) | [WRI-228](https://linear.app/uicb/issue/WRI-228) | Renderer `UpdateSection` in settings; hidden in dev |
| §6 (6.1–6.5) | [WRI-229](https://linear.app/uicb/issue/WRI-229) | Invariant guard test + typecheck/test/strict-validate + manual A→B survival E2E |

**Dependencies:** WRI-224 → (WRI-225, WRI-226); WRI-226 → WRI-227 → WRI-228; (WRI-225 + WRI-228) → WRI-229.

**Suggested order:** WRI-224 → WRI-226 → WRI-227 → WRI-228 → WRI-225 → WRI-229 → close WRI-223

**Prerequisite input:** public R2 update base URL (for WRI-225). Unsigned NSIS acceptable for first internal test (pending company policy).

**Branch:** `feat/hot-update`
