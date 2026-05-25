# Verification: figma-audit-redesign

**Change:** `figma-audit-redesign`  
**Verified at:** 2026-05-25  
**Implementation commit:** `ccffdfd`

## Automated

```bash
npm run typecheck
npm run test
openspec validate figma-audit-redesign --strict
```

Results (2026-05-25):

- `npm run typecheck` — pass (all workspaces)
- `npm run test` — pass (all workspaces)
- `openspec validate figma-audit-redesign --strict` — valid
- Daemon Figma MCP smoke (`GET /mcp/smoke/figma/read`) — pass (`whoami`, tools include `get_metadata`, `use_figma`)

## Manual (WRI-143)

Agent + local dev sign-off:

- Home → `/figma-audit` — form, single-frame audit, navigate to `/audits` and detail
- Figma MCP connected in Writer Agents (independent of Cursor MCP)
- TEXT extraction and review rows on detail page (including seed-from-extraction rows)
- Writeback: `figma.write` permission auto-grant on audit detail; skip when `before === after`
- Known fix in `ccffdfd`: full TEXT layer extraction (`toExtractedCopy`), writeback permission flow (`figma-writeback-flow.ts`)

Full checklist in `tasks.md` §10 — browse-page drag-reorder and partial-failure retry are best verified on next user pass.

## Delta specs

| Capability | Action |
|------------|--------|
| `figma-mcp-extraction` | ADD list-page-frames, frame screenshots |
| `review-session-storage` | ADD intent fields, writebackReport, mode |
| `desktop-shell` | ADD `/figma-audit`, `/audits`, `/audits/:sessionId` |

Sync to `openspec/specs/` at archive.

## Linear

Epic [WRI-134](https://linear.app/uicb/issue/WRI-134) — children WRI-135..WRI-142 implementation Done; WRI-143 manual sign-off; WRI-144 docs/archive.
