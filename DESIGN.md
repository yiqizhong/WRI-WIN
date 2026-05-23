# Writer — Design system (desktop)

## Theme

- **System:** IBM Carbon Design System via `@carbon/react` and `@carbon/icons-react`.
- **Shell theme:** `cds--g10` (light gray layer).
- **Register:** Product UI — restrained, state-rich, no decorative motion.

## IBM 2× Grid (required)

All routed screens MUST use `apps/desktop/src/layout/writer-grid.tsx`. Do not build page layout with ad-hoc `display: flex` or fixed `maxWidth` except inside grid columns.

References (read in order):

1. [IBM Design Language — Overview](https://www.ibm.com/design/language/2x-grid/)
2. [Carbon — Usage](https://carbondesignsystem.com/elements/2x-grid/usage/)
3. [Carbon — Code (`Grid`, `Column`)](https://react.carbondesignsystem.com/?path=/docs/elements-grid--default)

### Style model

**Product and docs** — left-aligned UI shell (SideNav grid influencer), fluid 16-column grid, max content width `99rem` (1584px) in `.writer-product-chrome__content`.

### Mini unit & breakpoints

| Breakpoint | Width | Columns | Padding | Margin |
|------------|-------|---------|---------|--------|
| sm | 320px | 4 | 16px | 0 |
| md | 672px | 8 | 16px | 16px |
| lg | 1056px | 16 | 16px | 16px |
| xlg | 1312px | 16 | 16px | 16px |
| max | 1584px | 16 | 16px | 24px |

Base unit: **8px** mini unit. Use Carbon spacing tokens (`--cds-spacing-*`) for vertical rhythm (2x, 3x, 4x …).

### Column spans (lg = 16 columns)

| Helper | lg span | Use |
|--------|---------|-----|
| `WriterPageGridFull` | 16 | Page intro, toolbars |
| `WriterPageGridHalf` | 8 | Two-up modules (queue \| changelog) |
| `WriterPageGridQuarter` | 4 | Four-column IBM product pattern |
| `WriterPageGridThird` | 5 / 6 / 5 | **Odd three-column** (legacy 12-col groups of three on 16-col grid) |

### Odd column configurations (groups of three)

Carbon Usage allows three-up layouts on the 16-column 2× grid without reverting to FlexGrid. Use `WriterPageGridThird` with `position`:

| Position | lg span | Role |
|----------|---------|------|
| `leading` | 5 | First third |
| `center` | 6 | Middle third (slightly wider) |
| `trailing` | 5 | Third third |

**5 + 6 + 5 = 16.** Below `lg`, each third stacks full width (`sm`/`md` = 4 or 8). Prefer halves or quarters when content is not naturally three-way; use thirds for Sources (Figma \| paste \| spreadsheet).

### Gutter modes (`WriterPageGrid` `gutterMode`)

| Mode | Carbon prop | When |
|------|-------------|------|
| `narrow` | `narrow` | **Default** for product pages (tiles, lists, split panels) |
| `wide` | (default) | **Forms** — inputs, radio groups, dropdowns (labels must not hang into gutter) |
| `condensed` | `condensed` | Dense dashboards (review queue + changelog); tiles use `border-subtle` |

Mix modes via **nested** `WriterPageGrid` inside a `Column` (Carbon subgrid).

### Screen map

| Screen | Page gutter | Layout |
|--------|-------------|--------|
| Review | `condensed` | Full toolbar; queue \| changelog halves |
| Sources | `narrow` | Intro full; **Figma \| paste \| spreadsheet** thirds (5+6+5); forms nested `wide` |
| Agents | `narrow` | LLM \| MCP halves; LLM radios nested `wide` |
| Settings | `wide` | Form in half column |

### Grid influencer

Fixed **SideNav** (256px) sits outside the fluid grid and reduces content area — per Carbon UI shell / Usage “left-hand navigation”.

## Color

- Use Carbon CSS variables (`--cds-text-primary`, `--cds-layer-01`, `--cds-border-subtle`, `--cds-focus`, `--cds-support-error`, etc.).
- Do not hard-code `#000`, `#fff`, or pastel alert hex fallbacks; use `InlineNotification` for errors.
- Selection / active provider: layer-selected background + focus border.

## Typography

- Inherit Carbon type scale (body 0.875rem, section titles 1rem, page title in ProductChrome 1.75rem light).
- Monospace for paths and tool names: `--cds-font-family-mono`.
- Align type to column grid; do not hang labels into gutters (Usage).

## Components

- **Buttons:** Primary for main actions; secondary for refresh; tertiary for in-card tests; ghost for cancel.
- **Forms:** `RadioButtonGroup`, `Toggle`, `TextArea` inside **`gutterMode="wide"`** grids only.
- **Feedback:** `InlineNotification`, `InlineLoading`, `Tag`.
- **Cards:** `Tile` in condensed grids need subtle borders (handled in SCSS).

## Motion

- 150ms transitions on `border-color` and `background-color` only—not `transition: all`.

## Fill vs Hug (auto-layout)

Use `apps/desktop/src/layout/writer-sizing.ts` class helpers and SCSS in `index.scss`. Prefer these over ad-hoc `flex: 1` or fixed heights.

| Element | Width | Height | Classes |
|---------|-------|--------|---------|
| Grid column / page column | **Fill** | Fill when row is equal-height | `gridCell(fillHeight)` on `WriterPageColumn` |
| `Tile` / panel in a column | **Fill** | **Fill** in equal-height rows | `surface` + `fillWidth`; `surfaceFillHeight` when the tile must stretch |
| Scrollable list / chat log | **Fill** | **Fill** (flex remainder) | `surfaceBody`, `writer-chat-scroll` |
| Vertical stack inside fill tile | **Fill** | **Fill** | `stackFill` on `Stack` or `WriterPageStack fill` |
| Page intro copy | **Hug** | **Hug** | `writer-intro-copy` (max-width cap) |
| Toolbar row (title + actions) | **Fill** | **Hug** | `rowBetween` |
| Button, Tag, IconButton | **Hug** | **Hug** | `hugWidth` / `hugHeight` |
| Dropdown in a mapping row | **Hug** | **Hug** | wrap in `hugHeight` div |
| TextArea in forms / composer | **Fill** | **Hug** (rows) | `fillWidth`; composer uses `writer-composer-input` |
| Chat bubble | **Hug** (max 85%) | **Hug** | `chatBubble` / `chatBubbleEnd` |
| Action row (Test connection) | **Fill** | **Hug** | `rowEnd` |

**Rules**

1. Anything in a **grid track** fills column width unless it is explicitly a chip, button, or bubble.
2. **Equal-height rows** (`equalRowHeight` + `fillHeight` on halves/thirds): child tiles use `surfaceFillHeight` + `stackFill` + `surfaceBody` for scroll regions.
3. Do not set `minHeight` on tiles for layout; use fill-height chain instead.
4. Nested form grids stay `gutterMode="wide"`; controls still **fill** their column, labels **hug** height.
