# Superpowers + OpenSpec (Writer)

This directory holds **product** design artifacts. With `superpowers-bridge` installed, **active change work** lives under `openspec/changes/<name>/` — not here.

## Layout

| Path | Purpose |
|------|---------|
| `specs/` | Long-lived product / design drafts (e.g. Figma UX Copy Review v1) |
| `plans/` | Optional; prefer `openspec/changes/<name>/plan.md` for implementation plans |

## Cursor setup (one-time per machine)

1. Install plugin: `/add-plugin superpowers`
2. Install CLI: `npm install -g @fission-ai/openspec@latest`
3. In repo root: `openspec update --force`
4. Restart Cursor

See root `AGENTS.md` for workflow routing and schema choice.

## Schemas

- **`superpowers-bridge`** — New features: brainstorm → proposal → design → specs → tasks → plan → apply (TDD + subagents) → verify → retrospective → archive  
  Installed at: `openspec/schemas/superpowers-bridge/`
- **`spec-driven`** — Lighter path; used by `bootstrap-local-platform`

## Quick commands

```text
/opsx:propose "add figma audit"
/opsx:ff my-feature
/opsx:apply
/opsx:verify
/opsx:archive
```
