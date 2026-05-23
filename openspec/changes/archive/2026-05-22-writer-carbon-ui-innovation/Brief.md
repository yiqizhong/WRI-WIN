# Brief · writer-carbon-ui-innovation

## Product

Writer — local Electron desktop app for Figma UX copy review with human-gated approval before writeback.

## Platform

Desktop (Electron), **1040×680 minimum** (current Writer constraint), target design canvas **1440×900** for layout decisions. Desktop-only; below min width horizontal scroll only (no adaptive shell unless explicitly added later).

## Locale

`en-US` — all UI strings hardcoded in screen files for this run (no i18n layer).

## Target users

1. **Copy reviewer (designer / content designer)** — runs audits, triages queue, approves or edits suggestions; 30–90 min focused sessions; switches between Review, Figma scope, and Agents/MCP often.
2. **Platform operator (power user)** — configures Cursor Agent / Devin, Figma MCP OAuth, brand voice; needs clear connection diagnostics without reading daemon logs.

## Problem

Current `@writer/desktop` uses ad-hoc CSS (`styles.css`) with partial IBM Carbon styling. Layout, IA, and component choices were not derived through the design-engineering pipeline. Visual hierarchy, density gradient, and Carbon component contracts are inconsistent with `pipeline-react-electron/design-knowledge` and `seed-app`.

## Goal

Re-innovate the desktop UI using the **Planner → Architect → Builder** pipeline:

- **Inputs (read-only):** `Design-engineering/pipeline-react-electron/design-knowledge/*`, `seed-app` shell conventions, agents `01-planner.md` + `02-architect.md`
- **Outputs:** TaskBreakdown, gate1, design-decisions, Carbon skeletons → implemented screens in `apps/desktop`
- **Brand:** IBM Carbon (company design-knowledge); Architect has no brand override authority

## In scope

- Information architecture for Review, Figma, Agents, Settings (maps to existing features)
- Carbon `ProductChrome` + seed-style masthead contract inside Writer Electron
- Screen-level innovation: review queue human gate, session setup, agents/MCP, platform settings
- Replace custom CSS panels with `@carbon/react` + design-knowledge tokens

## Out of scope

- Changing daemon API contracts (unless UI requires new fields — separate change)
- Mobile / responsive adaptive shell
- i18n / zh-CN (separate run)
- Modifying `design-knowledge/*` or `seed-app` brand assets (company-owned, read-only)

## Success criteria

- `npm run typecheck --workspace=@writer/desktop` passes
- Playwright smoke captures Review + Agents screens at 1440×900
- Sidebar shows **Daemon connected** when health is running (dynamic capabilities)
- All primary flows reachable via persistent nav without hamburger
- Critic Layer 1 checklist: no forbidden patterns from `restraint-rules.md`, components from `components-manifest.yaml`

## References

- Writer product spec: `docs/superpowers/specs/2026-05-22-figma-ux-copy-review-design.md`
- Pipeline agents: `Design-engineering/pipeline-react-electron/agents/01-planner.md`, `02-architect.md`
- Run artifacts path: `openspec/changes/writer-carbon-ui-innovation/artifacts/`
