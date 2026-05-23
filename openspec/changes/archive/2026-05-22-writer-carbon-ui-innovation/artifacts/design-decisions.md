# Design Decisions · writer-carbon-ui-innovation / v1

**Gate 1:** pass (`artifacts/gate1-feedback.json`)  
**Locale:** en-US  
**Brand:** IBM Carbon G10 — read-only; no token or brand overrides in this run.

---

## 0. 新增组件需求 (给 Orchestrator)

无。本 run 使用 `@carbon/react` 直接 import；Writer desktop 尚未安装 Carbon — Builder task WRI-74 先完成 deps。

---

## 0.1 完整性清单 (Architect Pre-pass)

```yaml
- kind: chrome
  name: ProductChrome
  target: artifacts/screens/_shared/ProductChrome.tsx
  源: TaskBreakdown §6 chrome · Decision 1 sidebar · Decision 4 daemon footer

- kind: shared
  name: NavItems
  target: artifacts/screens/_shared/NavItems.ts
  源: TaskBreakdown sitemap 4 routes

- kind: shared
  name: Routes
  target: artifacts/screens/_routes.ts
  源: TaskBreakdown §6

- kind: screen
  name: Review
  target: artifacts/skeletons/Review.tsx
  源: TaskBreakdown default route · Scenario 1/4

- kind: screen
  name: Sources
  target: artifacts/skeletons/Sources.tsx
  源: TaskBreakdown /figma · Decision 3

- kind: screen
  name: Agents
  target: artifacts/skeletons/Agents.tsx
  源: TaskBreakdown /agents · Scenario 3

- kind: screen
  name: Settings
  target: artifacts/skeletons/Settings.tsx
  源: TaskBreakdown /settings · Scenario 5
```

**Pass 1 对照:** 6 files + `_routes.ts` — all listed.

---

## 1. 共享文件清单 (给 Builder · 不许修改)

| File | Role |
|------|------|
| `artifacts/screens/_routes.ts` | Route table + default `/` → Review |
| `artifacts/screens/_shared/NavItems.ts` | Sidebar labels, paths, icon names |
| `artifacts/screens/_shared/ProductChrome.tsx` | Sidebar + header + daemon footer slot |

Builder copies/adapts into `apps/desktop/src/` after WRI-80.

---

## 2. 全局视觉决策 (结构 / 密度 · 非 brand)

### 2.1 壳层

- **Seed masthead:** unchanged (`AppShell` seed-owned); Writer Electron title "Writer".
- **ProductChrome:** `SideNav` 256px expanded rail inside `<main>` (y≥66). **Not** fixed Header overlapping masthead.
- **Header row:** `Open Project` primary (right) + page title (left). Single primary per screen (CommonActions).

### 2.2 主导航

- **形态:** `SideNav` + `SideNavItems` / `SideNavLink` (manifest: SideNav).
- **宽度:** 256px (`SideNav` expanded default).
- **Active:** `isActive` → layer-selected background; **no accent fill** (restraint L01).
- **Labels:** Review · **Sources** · Agents · Settings (Decision A3 from TaskBreakdown).

### 2.3 密度策略

| Zone | Density | Rationale |
|------|---------|-----------|
| Review queue rows | comfortable (StructuredList) | Variable before/after copy; min width 1040 |
| Sources forms | default spacing `$spacing-05` between groups | Setup / lower density |
| Agents cards | `$spacing-05` between provider + MCP blocks | Operator scan |
| Settings | Form single column max 640px | C · Border-Only friendly |

**Philosophy:** Information Density Gradient — core queue dense, setup sparse.

### 2.4 Elevation strategy

**A · Surface Contrast** (`visual-language.md`) — flat Tile borders, no shadow mixing.

### 2.5 视觉精度 (company brand 内)

```yaml
elevation_strategy: Surface Contrast (A)
typography_strength:
  semibold_usage: Page titles (Heading-03), queue copy labels only
  medium_usage: SideNav active labels via SideNavLink selected state
hover_treatment:
  primary_buttons: Carbon default primary hover
  nav_items: SideNavLink hover layer (no custom CSS)
accent_budget:
  total_occurrences_per_screen: 1
  positions: [Open Project] OR [Connect Figma] OR [Run audit] — one primary CTA per screen
```

### 2.6 动效

Carbon `--motion-fast` only; no animation > 320ms (L10).

### 2.7 Grid / Stack 标注 (全局)

- ProductChrome: `Stack vertical gap={0}` — SideNav column + content `flex: 1`.
- Content area: `Stack gap={7}` ($spacing-07 · 32px block spacing) per IDL.

---

## 3. 屏级决策

### Review

- **pattern:** Filtering  
- **pattern_decisions:** Status dropdown filter (proposed default); bulk approve as secondary; no live search v1.
- **pattern (empty):** EmptyStates — no session / empty queue variants.
- **Layout:** Page header strip (session context) → InlineNotification slot (max 1) → toolbar Stack horizontal → StructuredList queue.
- **Queue component:** StructuredList (not DataTable) — 2-field rows (before/after) + actions row; manifest: variable text length.
- **AABA:** A = queue rows (repeat); B = toolbar band (surface-1 background, full width).
- **Focus:** Queue occupies ≥60% vertical space below header.

### Sources

- **pattern:** Forms  
- **pattern_decisions:** Three sections stacked (Figma URL · pasted text · spreadsheet); no wizard steps.
- **Layout:** `Stack gap={7}` — Section Figma → Section Paste → Section Spreadsheet mapping.
- **Inputs:** TextInput (URL), TextArea (paste), FileUploader or secondary Import button (Builder wires existing picker).
- **AABA:** A = three similar section blocks; B = spreadsheet mapping panel (surface-2 when visible).

### Agents

- **pattern:** Forms + Notifications (inline only for smoke results)  
- **pattern_decisions:** Single InlineNotification region; OAuth polling updates same slot (TaskBreakdown A4).
- **Layout:** Two-column Grid at ≥1200px (LLM providers | MCP); single column at 1040.
- **LLM select:** RadioButtonGroup (2 providers).
- **MCP:** Toggle enabled + Connect Figma tertiary + Test read secondary.

### Settings

- **pattern:** Forms  
- **Layout:** Brand voice TextArea + Save secondary; project path helper text (full path here only — TaskBreakdown A5).

### ProductChrome

- **pattern:** GlobalHeader (partial — utilities only in header) + SideNav  
- **pattern_decisions:** No IBM product switcher; header = title + Open Project; nav in SideNav not HeaderNavigation (deep 4-area IA).
- **Daemon footer:** Tile in SideNav footer slot — status + Refresh ghost button.

---

## 4. Pass 2 质疑与 Pass 3 回应

### Q1: SideNav 256px eats queue width at 1040px  
**A1:** Keep 256px (manifest default). Queue uses StructuredList full-width text wrap; acceptable trade-off. Rejected: 48px rail-only (hides labels for new users).

### Q2: StructuredList vs DataTable for bulk select  
**A2:** No row checkbox bulk v1 — bulk approve visible filter only (existing API). StructuredList sufficient.

### Q3: Two-column Agents grid breaks at 1040  
**A3:** Grid collapses to 1 column `< 1200px` via CSS grid `grid-template-columns: 1fr` — Builder implements media query or single column always at min width.

### Q4: InlineNotification on Review duplicates Agents banner pattern  
**A4:** Shared `StatusBanner` component in Builder optional; skeleton marks one slot per screen.

---

## 5. Builder 迁移顺序 (WRI-80+)

1. Install `@carbon/react` + `@carbon/icons-react` + Sass (WRI-74).  
2. Port ProductChrome + routes.  
3. Review → Sources → Agents → Settings.  
4. Remove obsolete `styles.css` sections as screens migrate.
