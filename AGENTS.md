# Writer — Agent instructions

This repo combines **OpenSpec** (what to build) with **Superpowers** (how to build). Cursor setup lives under `.cursor/`; schemas under `openspec/`.

## Prerequisites (Cursor)

1. **Superpowers plugin** — In Agent chat: `/add-plugin superpowers` (or install "superpowers" from the Cursor plugin marketplace).
2. **OpenSpec CLI** — `npm install -g @fission-ai/openspec@latest`
3. **OpenSpec workflows** — This project expects the expanded workflow set (`new`, `continue`, `ff`, `verify`, `sync`, …). If slash commands are missing, run:
   ```bash
   openspec config profile
   ```
   Select **custom** and enable: propose, explore, new, continue, apply, ff, sync, verify, archive. Then in this repo:
   ```bash
   openspec update --force
   ```

## Workflow routing (read on session start)

This repo uses [`superpowers-bridge`](openspec/schemas/superpowers-bridge/) to bridge OpenSpec and Superpowers. Integration rules (artifact paths, PRECHECK) follow that schema README; this section is routing guidance for agents.

### Default schema

| Situation | Schema |
|-----------|--------|
| New feature / capability / architecture / breaking change | `superpowers-bridge` |
| In-progress `bootstrap-local-platform` | `spec-driven` (already pinned on the change) |
| Bug fix / typo / config tweak / docs-only (no contract change) | Direct PR — no opsx change |

Set default for new changes in `openspec/config.yaml` (`schema: superpowers-bridge`). Override per change: `openspec new change <name> --schema spec-driven`.

### Entry routing

| Trigger | Action |
|---------|--------|
| Narrative "design discussion / let's brainstorm" | Verbal `superpowers:brainstorming` — **do not** write to `docs/superpowers/specs/`. When all 5 promotion criteria below hold, suggest `/opsx-propose` |
| `/opsx:new` / `/opsx:ff` / `/opsx:propose` | Follow schema flow; use `--schema superpowers-bridge` for new product work |
| Bug fix / typo / config / docs only | Direct PR — **do not** open a change |
| Mid-change | `/opsx:continue`, `/opsx:apply`, `/opsx:verify`, `/opsx:archive` |

### Verbal brainstorm → opsx (all 5 required)

1. **Scope locked** — one sentence for in/out of scope  
2. **Major forks resolved** — TBDs have owner + impact  
3. **Dependencies mapped** — ready / mockable / unknown per dependency  
4. **Acceptance criteria stateable** — e.g. `npm run typecheck && npm run test` + concrete deliverables  
5. **Conversation converging** — recent turns confirm, not new forks  

When all hold → suggest `/opsx-propose` and wait for user ack. Never auto-promote.

### Front-door anti-patterns

- Brainstorming → `docs/superpowers/specs/` (use change dir: `openspec/changes/<name>/brainstorm.md`)
- writing-plans → `docs/superpowers/plans/` (use `plan.md` in the change dir)
- Opening opsx for trivial bugfix/typo
- Promoting with unresolved blocking TBDs

### Recommended flows

**New feature (superpowers-bridge):**

```text
/opsx:ff my-feature --schema superpowers-bridge   # or stepwise /opsx:new + /opsx:continue
/opsx:apply
/opsx:verify
/opsx:continue    # → retrospective
/opsx:archive
```

**Continue platform bootstrap (spec-driven):**

```text
/opsx:apply bootstrap-local-platform
```

## Linear sync (required after each task)

When finishing an OpenSpec task and committing:

1. Check off the task in `openspec/changes/<change>/tasks.md`.
2. Commit (one task per commit when possible).
3. Update the mapped **WRI-*** issue: state + short comment (commit SHA, what shipped).

Mapping table: `docs/linear-openspec-map.md` · Project: [Figma UX Copy Review v1](https://linear.app/uicb/project/figma-ux-copy-review-v1-4a213fbaf788).

## Project docs

- Product spec: `docs/superpowers/specs/2026-05-22-figma-ux-copy-review-design.md`
- Architecture: `docs/architecture/local-platform-architecture.md`
- Superpowers conventions: `docs/superpowers/README.md`
- OpenSpec ↔ Linear map: `docs/linear-openspec-map.md`
