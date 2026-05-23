# OpenSpec ↔ Linear sync

**Project:** [Figma UX Copy Review v1](https://linear.app/uicb/project/figma-ux-copy-review-v1-4a213fbaf788)  
**Team:** Wri (`WRI`)  
**Active change:** `bootstrap-local-platform`

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

**Parent:** WRI-1 — Platform Foundation (epic for M1)

**Milestone:** M0 = WRI-41 · M1 = WRI-1 subtree

## Comment template

```markdown
OpenSpec `bootstrap-local-platform` task **X.Y** done.

- Commit: `<sha>` — <one-line summary>
- Verified: `npm run typecheck` / `npm test` (if run)
```
