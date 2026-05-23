# OpenSpec ↔ Linear sync

**Project:** [Figma UX Copy Review v1](https://linear.app/uicb/project/figma-ux-copy-review-v1-4a213fbaf788)  
**Team:** Wri (`WRI`)  
**Active change:** `writer-carbon-ui-innovation`

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
