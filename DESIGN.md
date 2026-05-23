# Writer — Design system (desktop)

## Theme

- **System:** IBM Carbon Design System via `@carbon/react` and `@carbon/icons-react`.
- **Shell theme:** `cds--g10` (light gray layer).
- **Register:** Product UI — restrained, state-rich, no decorative motion.

## Color

- Use Carbon CSS variables (`--cds-text-primary`, `--cds-layer-01`, `--cds-border-subtle`, `--cds-focus`, `--cds-support-error`, etc.).
- Do not hard-code `#000`, `#fff`, or pastel alert hex fallbacks; use `InlineNotification` for errors.
- Selection / active provider: layer-selected background + focus border, not full accent fill (restraint L01 for nav; selection may use focus token).

## Typography

- Inherit Carbon type scale (body 0.875rem, section titles 1rem, page title in ProductChrome 1.75rem light).
- Monospace for paths and tool names: `--cds-font-family-mono`.
- Section labels: sentence case preferred over ALL CAPS except compact metadata labels (e.g. “Executable path”).

## Spacing

- Carbon spacing tokens: `--cds-spacing-01` through `--cds-spacing-07`.
- Section stacks: `gap={7}` page, `gap={5}` within sections, `gap={4}` inside cards.

## Layout

- **ProductChrome:** Fixed SideNav + main content padding `--cds-spacing-06`.
- **Agents:** Two-column `Grid` at large breakpoints; single column when stacked.
- **Settings:** Single column max-width ~640px.

## Components

- **Buttons:** Primary for main actions (Open project); secondary for refresh; tertiary for in-card tests; ghost for cancel.
- **Forms:** `RadioButtonGroup`, `Toggle`, `TextArea` with `labelText` / `helperText`.
- **Feedback:** `InlineNotification` (dismissible where appropriate), `InlineLoading` for refresh/load, `Tag` for status.
- **Cards:** `Tile` for grouped content; not nested clickable tiles—use proper radio/toggle semantics.

## Motion

- 150ms transitions on `border-color` and `background-color` only—not `transition: all`.
- No page-load choreography; motion conveys state (loading, success, error).
