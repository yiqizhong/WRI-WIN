# Proposal · Writer Carbon UI Innovation

## Why

Writer desktop shipped fast with a single-file CSS reskin. The design-engineering pipeline (IBM Carbon design-knowledge + seed-app + Planner/Architect agents) exists to produce defensible IA, density, and component decisions. We should run a formal pipeline pass before the next UI iteration lands in production.

## What changes

1. **Planner phase** — 3-pass TaskBreakdown + gate1.html from `Brief.md`
2. **Architect phase** — design-decisions.md + Carbon skeletons per screen + `ProductChrome`
3. **Builder phase** — migrate `apps/desktop` from custom CSS to Carbon components aligned with skeletons
4. **Verify** — typecheck, Playwright screenshots, restraint-rules spot check

## Approach (recommended)

**Embedded pipeline run in Writer repo** (`openspec/changes/writer-carbon-ui-innovation/artifacts/`):

- Read-only symlink/reference to external `design-knowledge` (no copies that drift)
- Adopt `seed-app` shell contract (`AppShell` masthead + optional `ProductChrome`) inside Writer
- Incremental screen migration after Architect sign-off (Review → Figma → Agents → Settings)

Rejected alternatives:

- **Full run only in pipeline repo** — slower handoff to Writer product code
- **CSS-only Carbon reskin** — already tried; misses IA, manifests, and Critic gates

## Impact

- Affected: `apps/desktop` (renderer), `docs/linear-openspec-map.md`
- Not affected: daemon routes, contracts (unless UI gaps discovered)

## Tracking

Linear epic **WRI-72** with child issues per pipeline phase (see `docs/linear-openspec-map.md`).
