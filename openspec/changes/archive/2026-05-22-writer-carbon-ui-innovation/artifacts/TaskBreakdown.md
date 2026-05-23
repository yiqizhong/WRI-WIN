# Task Breakdown · writer-carbon-ui-innovation / v1

**Brief:** `openspec/changes/writer-carbon-ui-innovation/Brief.md`  
**Locale:** `en-US` (confirmed)  
**Platform:** Desktop Electron · 1040×680 min · design canvas 1440×900

---

## 1. 我对产品的理解

Writer is a local-first desktop review tool: designers and content designers audit UX copy sourced from Figma (or pasted text / spreadsheets), triage LLM proposals in a **mandatory human gate**, then apply approved changes back to Figma. A local daemon owns privileged operations (MCP, agents, files, writeback); the desktop shell is the control surface for long, focused review sessions.

The design problem is not "make it pretty" — the current UI stacks every workflow on one scrollable page. Operators lose **state visibility** (which project, which session, which adapter, daemon health) while reviewers cannot keep the **approval queue** as the persistent focal surface. The pipeline run must restructure IA and interaction logic under IBM Carbon brand (read-only), without changing daemon contracts in this change.

---

## 2. Personas

### Persona A · Copy reviewer (Morgan)

- **Role:** Designer or content designer running copy audits before handoff.
- **Mental model:** "Inbox → inspect before/after → approve or fix → export / writeback." Thinks in **sessions** tied to a Figma scope or pasted import.
- **Friction points:**
  - Cannot see queue status while configuring Figma URL on the same scroll page.
  - Bulk approve and filter-by-status are buried below setup cards.
  - Unclear whether an audit ran or queue is empty vs. no session.
- **Success signal:** Opens app → sees active session + proposed count → approves/edits items → exports report in under 5 clicks from queue.

### Persona B · Platform operator (Alex)

- **Role:** Power user who owns Cursor Agent / Devin selection and Figma MCP OAuth on a machine.
- **Mental model:** "Connections must be green before I ask Morgan to review." Reads **diagnostic codes**, not daemon logs.
- **Friction points:**
  - Daemon "degraded" message does not name which capability failed until refresh.
  - Agent and MCP settings mixed with review content on one page.
  - After daemon restart, must re-enable Figma without a guided recovery path.
- **Success signal:** Agents screen shows provider + MCP status with recovery actions; daemon tile matches `/health` within one refresh.

---

## 3. Scenarios

### Scenario 1 · Figma flow audit (core)

- **Trigger:** Morgan opens a project, pastes Figma URL, starts session, runs audit.
- **User flow:** Open project → **Figma** screen → connect scope → start session → **Review** screen → filter `proposed` → approve/edit/reject → export Markdown.
- **Success signal:** Queue populates with `proposed` items; state pills reflect human gate SM.
- **Failure mode:** Figma MCP auth fails — user stays on Agents, fixes OAuth, returns to Figma without losing project context.

### Scenario 2 · Pasted text / spreadsheet light edit

- **Trigger:** Morgan has copy not in Figma; imports CSV or pastes text.
- **User flow:** **Figma** screen (or dedicated import section) → paste / import → map columns if needed → create session → **Review** queue → audit stub → triage.
- **Success signal:** Session ID visible in Review header; spreadsheet mapping confirmed before session create.
- **Failure mode:** Mapping invalid — inline error on form (not toast), session not created.

### Scenario 3 · Platform setup before review

- **Trigger:** Alex configures Devin + Figma MCP on fresh install.
- **User flow:** **Agents** → select Devin → test connection → enable Figma MCP → Connect Figma → test read → daemon shows connected.
- **Success signal:** Smoke banners use persistent inline status (success/error regions), not disappearing toasts for failures.
- **Failure mode:** CLI missing — diagnostic shows `executable not found` + path hint.

### Scenario 4 · Bulk approval under time pressure

- **Trigger:** Morgan has 40+ proposed items, wants to approve visible set.
- **User flow:** **Review** → filter `proposed` → bulk approve visible → spot-check `approved` → export.
- **Success signal:** Bulk action updates queue without navigation change.
- **Failure mode:** No session — empty state explains "Start a session on Figma or Import" with links (text only, no onboarding bubble).

### Scenario 5 · Brand voice persistence

- **Trigger:** Alex sets brand voice for project once.
- **User flow:** **Settings** → edit brand voice → save → message in persistent banner (not toast-only for failure).
- **Success signal:** Active project name + path visible in chrome context area.
- **Failure mode:** Save fails — inline error per restraint L04.

---

## 4. 设计目标

1. **Persistent navigation** — Review, Figma, Agents, Settings reachable in one click; no hamburger at desktop widths.
2. **Review queue as home** — Default route emphasizes human gate queue when a session exists; otherwise guided empty state.
3. **State visibility** — Project, session, daemon, active adapter always visible in product chrome or sidebar footer.
4. **Density gradient** — Queue/table = comfortable-high density; setup forms = lower density; stats/hero cards removed from v1 IA.
5. **Operator isolation** — Agents/MCP diagnostics live on Agents screen, not duplicated on Review.
6. **en-US copy** — All UI strings hardcoded English; dates/numbers US conventions.

---

## 5. 关键决策 (6 字段)

### Decision 1 · Persistent sidebar primary navigation

- **decision:** Four top-level areas (Review, Figma, Agents, Settings) use a **persistent left sidebar** inside ProductChrome, not a single-page scroll stack.
- **evidence:** Persona A switches contexts 3–5 times per 30+ min session (Brief target users). Current monolithic page hides queue below fold. Product spec emphasizes review queue as primary UI (Human Gate section).
- **philosophy_anchor:** `decision-philosophy.md#Persistence Over Discovery`; `composition-rules.md#Pattern: Persistent + Contextual Navigation`
- **alternative_rejected:** Top tabs — rejected because 4 fixed areas fit tabs, but sidebar scales to future areas (Changelog, Reports) without tab overflow; matches existing Writer mental model and seed-app ProductChrome pattern for depth tools.
- **failure_mode:** If product grows beyond ~8 primary areas, sidebar needs grouping; acceptable at v1 (4 areas).
- **falsifiable_claim:** "Sidebar reduces time-to-queue vs. single-page scroll" — falsified if usability test shows users scroll faster to queue on one page.

### Decision 2 · Review is default landing route

- **decision:** Default route `/` = **Review** screen (queue + session context), not a marketing-style dashboard.
- **evidence:** Scenario 1 success signal centers on queue; human gate is v1 mandatory path. No KPI dashboard in product spec v1.
- **philosophy_anchor:** `decision-philosophy.md#Quiet Confidence` (no hero selling features); `composition-rules.md#Pattern: State Visibility`
- **alternative_rejected:** Dashboard with cards (current hero-panel layout) — rejected as LLM default "workspace overview" that duplicates Figma/Review entry points and violates density gradient (equal-weight cards).
- **failure_mode:** Empty first-run experience feels bare — mitigated by empty state copy + links to Figma/Agents, not a dashboard.
- **falsifiable_claim:** "Review-first reduces clicks to first approval" — falsified if analytics show users always navigate away before acting.

### Decision 3 · Figma scope setup on dedicated screen

- **decision:** Figma URL, session start, pasted text, and spreadsheet import live on **Figma** screen (session sources), not inline on Review.
- **evidence:** Scenario 1 flow separates setup from triage; Morgan's friction #1 is mixed setup + queue. Spreadsheet mapping is pre-session (WRI-44 pattern).
- **philosophy_anchor:** `composition-rules.md#Pattern: Information Density Gradient`
- **alternative_rejected:** Unified "New review" wizard modal — rejected: modal hides persistent nav context (State Visibility anti-pattern); multi-step wizard adds steps without reducing cognitive load for power users.
- **failure_mode:** Two-screen flow feels slow for repeat Figma URL — mitigated by remembering last URL in session storage (Builder detail, not IA change).
- **falsifiable_claim:** "Dedicated Figma screen lowers mis-session rate" — falsified if users start wrong session type more often than today.

### Decision 4 · Daemon status in sidebar footer tile (persistent)

- **decision:** Daemon connection state (connected / degraded / unavailable) stays in a **persistent footer tile** of the sidebar, with capability detail and Refresh — not only a toast or top banner.
- **evidence:** Persona B friction on "degraded" ambiguity; restraint L04 forbids toast for critical connectivity. Brief success criterion: dynamic health reflected in UI.
- **philosophy_anchor:** `composition-rules.md#Pattern: State Visibility`; `restraint-rules.md#L04`
- **alternative_rejected:** Header badge only — rejected: badge lacks recovery detail and disappears on narrow focus; operators need diagnostic text visible while on Agents screen.
- **failure_mode:** Footer tile competes with nav scroll if many nav items — not an issue at 4 items.
- **falsifiable_claim:** "Persistent footer reduces MCP misconfiguration support burden" — falsified if users still open logs first.

### Decision 5 · Inline status regions, not toast, for smoke tests

- **decision:** Agent smoke, Figma read smoke, and save failures use **persistent inline banners** on the relevant screen until dismissed or superseded.
- **evidence:** restraint L04 hard rule; current AgentTestStatusBanner already inline — preserve and extend pattern.
- **philosophy_anchor:** `restraint-rules.md#L04`; `decision-philosophy.md#Quiet Confidence`
- **alternative_rejected:** Carbon ToastNotification for success/failure — rejected for errors; optional for non-critical success only (Architect may omit toasts entirely for v1).
- **failure_mode:** Banner stacking if user runs many smokes — Architect caps one active banner per screen.
- **falsifiable_claim:** "Inline errors reduce missed failure rate vs toast" — standard UX claim, test in session replay.

### Decision 6 · Session context strip on Review header

- **decision:** Review screen header shows **project name**, **session id (short)**, **source type** (figma | pasted | spreadsheet), and **queue counts by status** when session active.
- **evidence:** State Visibility pattern; Scenario 4 bulk approve needs filter context; product spec state machine has many statuses.
- **philosophy_anchor:** `composition-rules.md#Pattern: State Visibility`
- **alternative_rejected:** Session info only in window title — rejected: Electron title not readable enough; no status counts.
- **failure_mode:** Header clutters on small width — truncate with tooltip (Builder); min width 1040 allows single row.
- **falsifiable_claim:** "Header strip reduces wrong-session edits" — falsified if users approve wrong session despite strip.

### Decision 7 · Open Project remains global chrome action

- **decision:** **Open Project** stays a primary action in product header (not buried in Settings).
- **evidence:** Scenario 1 starts with project; frequency >1 per session for multi-project users; Discoverability vs Persistence — high frequency.
- **philosophy_anchor:** `composition-rules.md#Pattern: Discoverability vs Persistence`
- **alternative_rejected:** Project picker only in Settings — rejected: adds navigation for first action every launch.
- **failure_mode:** Header crowded — single primary button acceptable per IBM accent budget (Architect).
- **falsifiable_claim:** "Header Open Project faster than Settings picker" — trivially true; falsified if users never use it.

---

## 6. 信息架构 (给 Architect 的输入)

### Sitemap

```
Writer Desktop
├── Review (default `/`)
│   ├── Queue list (filter by status)
│   ├── Item detail / inline edit
│   └── Bulk actions + export toolbar
├── Figma (`/figma`)
│   ├── Figma URL + scope banner
│   ├── Start Figma session
│   ├── Pasted text area
│   └── Spreadsheet import + mapping panel
├── Agents (`/agents`)
│   ├── LLM providers (radio select)
│   ├── MCP servers (Figma toggle + OAuth + read smoke)
│   └── Refresh detection
└── Settings (`/settings`)
    ├── Brand voice form
    └── Platform setup copy (links to Agents for connections)

Chrome (cross-cutting, not routes)
├── Seed masthead (y=0..56, seed-owned)
├── ProductChrome
│   ├── Sidebar nav (4 items)
│   ├── Header: Open Project + page title
│   └── Sidebar footer: daemon status tile
```

### 关键流程

1. **Figma audit:** Figma → start session → Review → audit → triage → export  
2. **Platform prep:** Agents → test CLI → Connect Figma → Review (empty → start session)  
3. **Spreadsheet:** Figma → import → map columns → create session → Review  
4. **Brand voice:** Settings → save → (daemon persists; affects future audits)

---

## 7. 交互逻辑约束

- **导航模式:** Persistent sidebar + MemoryRouter; active item uses surface change, **not accent color** (restraint L01). Architect implements with Carbon SideNav or equivalent inside ProductChrome.
- **状态变化:**
  - No session: Review shows empty state with text links to Figma screen (no modal wizard).
  - Session active: Review header strip populated; queue polls on user action (no auto-polling v1 unless already implemented).
  - Daemon degraded: footer tile warning tone + degraded capability messages from `/health`.
- **错误 / 空状态:**
  - Connection/smoke failures: inline banner on Agents (L04).
  - Queue empty after audit: explain filter or "Run audit" (toolbar on Review).
  - No project: Open Project disabled states on session actions with one-line reason.
- **Locale:** en-US strings; sentence case labels; no ALL CAPS eyebrows (IBM typography rules).

---

## 8. 给 Architect 的开放问题

1. **Review queue component:** DataTable vs structured list (Tile stack) for variable-length before/after text — match `patterns-manifest.yaml` (Filtering? EmptyStates?) before free composition.
2. **Sidebar width:** 256px vs 288px — align to Carbon `$spacing` grid and seed shell content inset.
3. **Export toolbar:** Sticky subheader on Review vs overflow menu — trade-off between Persistence and header height.
4. **Spreadsheet mapping:** Same screen section below paste on Figma vs stepped sub-section — density gradient within Figma screen.
5. **AABA rhythm:** Which block on Review is the B unit (e.g., bulk toolbar band vs queue rows) — per `ibm-design-tokens.json#rhythm_and_grouping`.
6. **Accent budget:** Only primary CTAs (Open Project, Connect Figma, Run audit) use IBM Blue fill; nav active uses surface (L01).

---

## 9. Pass 2 质疑与 Pass 3 回应 (推导密度证据)

### Q1: "Persistent sidebar for only 4 items is LLM default — why not top HeaderNavigation?"

**A1:** Accepted partial critique. Four items fit top nav at 1440px. Sidebar chosen for (a) alignment with existing Writer nav users already learned, (b) footer daemon tile natural anchor, (c) future Reports/Changelog without restructuring. Architect may use Carbon `SideNav` **or** compact `HeaderNavigation` **if** footer tile relocates to sidebar column — but **must not** use hamburger at desktop. Falsifiable claim stands.

### Q2: "Review as home fails first-run — empty queue is demoralizing."

**A2:** Modified empty state strategy: Review home shows **project-first** empty copy ("Open a project, then start a session on Figma") with two text actions — not a dashboard. Quiet Confidence (no feature tour). Decision 2 retained.

### Q3: "Splitting Figma + pasted text on 'Figma' screen mislabels the route."

**A3:** Renamed route label for nav: **"Sources"** display label acceptable in en-US while path stays `/figma` for code continuity — **Architect decision**. If label "Figma" kept, add subheading "Figma, paste, and spreadsheet" in page header (Builder string). Prevents false naming without new route slug in this change.

### Q4: "Inline banners everywhere will stack ugly on Agents during OAuth loop."

**A4:** Agree. Pass 3 constraint: **one** `AgentTestStatusBanner` region per screen; new smoke replaces previous message. OAuth polling messages update same region, not new toasts.

### Q5: "Session context strip duplicates project banner already on page."

**A5:** Accepted. Remove redundant global project banner from main scroll; **only** chrome/header strip + Settings shows full path. Reduces duplicate State Visibility noise.

### Q6: "1040px min width — sidebar + queue table won't fit."

**A6:** Architect must define Review queue as **list-first** (stacked before/after) below 1200px optional breakpoint **or** horizontal scroll on table — desktop-only per Brief, no adaptive shell. Queue readability beats table columns at min width.

---

*Planner output · Pass 3 reconciled · ready for gate1.html (WRI-76)*
