# Chat Motion Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each implementation task begins with a failing test before production changes.

**Goal:** Replace the Chat first-send flash with a continuous retained-Composer transition and add responsive, capped multiline Composer sizing without destabilizing scrolling or accessibility.

**Architecture:** The existing runtime shell, optimistic turn, and footer scroll observer remain the functional foundation. Add two small pure helper modules for testable motion and sizing policy; `ChatShellView` retains one Composer node and animates between measured anchors, while `WriterChatComposer` owns only Chat-specific height measurement and overflow behavior. Styling remains local to Chat and disables interpolation under reduced-motion preference.

**Tech Stack:** TypeScript, React 19, Vite, Electron renderer CSS, Vitest.

**Scope note:** OpenSpec tasks 1.1–4.3 are existing baseline work. This plan implements only pending motion increment tasks 5.1–5.6 mapped to Linear issues WRI-154, WRI-155, and WRI-149.

---

## File Structure

- `apps/desktop/src/paste-text-chat-runtime/composer-motion.ts`: pure transition policy and FLIP offset calculations.
- `apps/desktop/src/paste-text-chat-runtime/composer-motion.test.ts`: motion direction, reduced-motion, and offset unit tests.
- `apps/desktop/src/paste-text-chat-runtime/chat-shell-view.tsx`: single Composer render site, welcome/active anchors, and layout-transition lifecycle.
- `apps/desktop/src/components/writer/writer-chat-composer-sizing.ts`: pure 1–5 line sizing/clamp policy.
- `apps/desktop/src/components/writer/writer-chat-composer-sizing.test.ts`: sizing and overflow unit tests.
- `apps/desktop/src/components/writer/writer-chat-composer.tsx`: textarea ref, measured target height, and Chat-only inline height/overflow state.
- `apps/desktop/src/text-copy-chat.tsx`: mark optimistic user row for first-message entrance where needed.
- `apps/desktop/src/styles/writer-chat-welcome.css`: Composer travel, heading/message entrance, height transition, and reduced-motion rules.
- `openspec/changes/paste-text-chat-runtime-shell/tasks.md`: check off motion tasks after evidence exists.
- `openspec/changes/paste-text-chat-runtime-shell/verify.md`: record final automated and manual evidence.
- `docs/linear-openspec-map.md`: retain WRI-154/WRI-155 mapping and final status evidence.

---

## Task 1: First-Send Composer Continuity (WRI-154)

**Files:**
- Create: `apps/desktop/src/paste-text-chat-runtime/composer-motion.ts`
- Create: `apps/desktop/src/paste-text-chat-runtime/composer-motion.test.ts`
- Modify: `apps/desktop/src/paste-text-chat-runtime/chat-shell-view.tsx`
- Modify: `apps/desktop/src/text-copy-chat.tsx`
- Modify: `apps/desktop/src/styles/writer-chat-welcome.css`

- [ ] **Step 1.1 (Red): Write motion-policy unit tests**

Create `apps/desktop/src/paste-text-chat-runtime/composer-motion.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { composerFlipDelta, composerMotionForPhases } from "./composer-motion";

describe("composerMotionForPhases", () => {
  it("animates the first send toward the active dock", () => {
    expect(composerMotionForPhases("welcome", "active", false)).toEqual({
      direction: "to-active",
      animate: true
    });
  });

  it("animates new chat back toward welcome", () => {
    expect(composerMotionForPhases("active", "welcome", false)).toEqual({
      direction: "to-welcome",
      animate: true
    });
  });

  it("suppresses interpolation for reduced motion", () => {
    expect(composerMotionForPhases("welcome", "active", true).animate).toBe(false);
  });
});

describe("composerFlipDelta", () => {
  it("returns the translation from the active dock to a welcome anchor", () => {
    expect(
      composerFlipDelta(
        { left: 120, top: 240 },
        { left: 120, top: 660 }
      )
    ).toEqual({ x: 0, y: -420 });
  });
});
```

Run: `npm run test --workspace @writer/desktop -- composer-motion.test.ts`

Expected: FAIL because `./composer-motion` does not exist.

- [ ] **Step 1.2 (Green): Implement the minimal pure motion policy**

Create `apps/desktop/src/paste-text-chat-runtime/composer-motion.ts`:

```ts
import type { ChatPhase } from "./chat-phase";

type Position = Pick<DOMRect, "left" | "top">;

export function composerFlipDelta(anchor: Position, dock: Position) {
  return { x: anchor.left - dock.left, y: anchor.top - dock.top };
}

export function composerMotionForPhases(
  previous: ChatPhase,
  next: ChatPhase,
  reducedMotion: boolean
) {
  const direction =
    previous === "welcome" && next === "active"
      ? "to-active"
      : previous === "active" && next === "welcome"
        ? "to-welcome"
        : null;

  return {
    direction,
    animate: direction !== null && !reducedMotion
  };
}
```

Run: `npm run test --workspace @writer/desktop -- composer-motion.test.ts`

Expected: PASS.

- [ ] **Step 1.3 (Red): Add a source-level regression assertion for one Composer render site**

Extend `composer-motion.test.ts` with a source assertion that fails before the shell refactor:

```ts
import { readFileSync } from "node:fs";

it("renders the supplied composer exactly once in ChatShellView", () => {
  const source = readFileSync(
    new URL("./chat-shell-view.tsx", import.meta.url),
    "utf8"
  );
  expect(source.match(/\{composer\}/g)).toHaveLength(1);
});
```

Run: `npm run test --workspace @writer/desktop -- composer-motion.test.ts`

Expected: FAIL because the current welcome and active branches each render `{composer}`.

- [ ] **Step 1.4 (Green): Retain one Composer node and animate between anchors**

Refactor `ChatShellView` so one active-shell structure is always mounted:

```tsx
const welcomeAnchorRef = useRef<HTMLDivElement>(null);
const composerDockRef = useRef<HTMLDivElement>(null);
const previousPhaseRef = useRef(phase);
const [welcomeDelta, setWelcomeDelta] = useState({ x: 0, y: 0 });
const [transitioning, setTransitioning] = useState(false);

useLayoutEffect(() => {
  const anchor = welcomeAnchorRef.current;
  const dock = composerDockRef.current;
  if (anchor && dock) {
    setWelcomeDelta(composerFlipDelta(anchor.getBoundingClientRect(), dock.getBoundingClientRect()));
  }
}, [phase]);

useLayoutEffect(() => {
  const dock = composerDockRef.current;
  const previous = previousPhaseRef.current;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const motion = composerMotionForPhases(previous, phase, reduced);
  previousPhaseRef.current = phase;
  if (!dock || !motion.animate) return;
  setTransitioning(true);
  const finish = () => setTransitioning(false);
  dock.addEventListener("transitionend", finish, { once: true });
  return () => dock.removeEventListener("transitionend", finish);
}, [phase]);
```

Render a welcome greeting plus non-interactive anchor in the flexible scroll region when `phase === "welcome"`, render the thread when active, and render `composer` only inside one footer/dock node. Apply `--writer-composer-welcome-x` and `--writer-composer-welcome-y` variables from `welcomeDelta`; set `data-phase` and `data-transitioning` attributes on the shell/dock.

In `writer-chat-welcome.css`, add the local motion rule:

```css
.writer-chat-composer-motion-dock {
  transform: translate3d(0, 0, 0);
  transition: transform 240ms cubic-bezier(0.65, 0, 0.35, 1);
}

.writer-chat-composer-motion-dock[data-phase="welcome"] {
  transform: translate3d(
    var(--writer-composer-welcome-x, 0),
    var(--writer-composer-welcome-y, 0),
    0
  );
}
```

Add a welcome-title exit state and apply a class such as `writer-chat-user-bubble--entering` only to the optimistic first user message in `text-copy-chat.tsx`; enter it using opacity plus a small positive `translateY`.

Run:

```bash
npm run test --workspace @writer/desktop -- composer-motion.test.ts
npm run typecheck --workspace @writer/desktop
```

Expected: PASS.

- [ ] **Step 1.5: Update OpenSpec and Linear evidence**

Mark `tasks.md` items `5.1` (transition portion) and `5.2` complete only after the tests pass. Add a short Linear comment to WRI-154 with changed paths and test evidence; change WRI-154 to `In Progress` before work and `Done` only after Task 1 verification.

---

## Task 2: Responsive Multiline Composer (WRI-155)

**Files:**
- Create: `apps/desktop/src/components/writer/writer-chat-composer-sizing.ts`
- Create: `apps/desktop/src/components/writer/writer-chat-composer-sizing.test.ts`
- Modify: `apps/desktop/src/components/writer/writer-chat-composer.tsx`
- Modify: `apps/desktop/src/styles/writer-chat-welcome.css`
- Modify: `apps/desktop/src/paste-text-chat-runtime/use-paste-text-chat-runtime.ts` only if resize observation requires an explicit final-settle signal

- [ ] **Step 2.1 (Red): Write sizing-policy tests**

Create `apps/desktop/src/components/writer/writer-chat-composer-sizing.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { composerHeightForContent } from "./writer-chat-composer-sizing";

describe("composerHeightForContent", () => {
  it("keeps one visible line as the minimum", () => {
    expect(composerHeightForContent({ scrollHeight: 10, lineHeight: 23 })).toEqual({
      height: 23,
      overflowY: "hidden"
    });
  });

  it("allows content through five visible lines", () => {
    expect(composerHeightForContent({ scrollHeight: 92, lineHeight: 23 })).toEqual({
      height: 92,
      overflowY: "hidden"
    });
  });

  it("caps longer drafts and enables internal scroll", () => {
    expect(composerHeightForContent({ scrollHeight: 161, lineHeight: 23 })).toEqual({
      height: 115,
      overflowY: "auto"
    });
  });
});
```

Run: `npm run test --workspace @writer/desktop -- writer-chat-composer-sizing.test.ts`

Expected: FAIL because the sizing helper does not exist.

- [ ] **Step 2.2 (Green): Implement line-height clamping**

Create `apps/desktop/src/components/writer/writer-chat-composer-sizing.ts`:

```ts
const MIN_VISIBLE_LINES = 1;
const MAX_VISIBLE_LINES = 5;

export function composerHeightForContent(input: {
  scrollHeight: number;
  lineHeight: number;
}) {
  const minHeight = input.lineHeight * MIN_VISIBLE_LINES;
  const maxHeight = input.lineHeight * MAX_VISIBLE_LINES;
  const height = Math.max(minHeight, Math.min(input.scrollHeight, maxHeight));

  return {
    height,
    overflowY: input.scrollHeight > maxHeight ? "auto" : "hidden"
  } as const;
}
```

Run: `npm run test --workspace @writer/desktop -- writer-chat-composer-sizing.test.ts`

Expected: PASS.

- [ ] **Step 2.3 (Green): Wire Chat-only measured sizing into `WriterChatComposer`**

In `writer-chat-composer.tsx`, keep the shared `Textarea` primitive unchanged and add a local ref/effect:

```tsx
const textareaRef = useRef<HTMLTextAreaElement>(null);
const [textareaStyle, setTextareaStyle] = useState<CSSProperties>();

useLayoutEffect(() => {
  const textarea = textareaRef.current;
  if (!textarea) return;
  const lineHeight = Number.parseFloat(window.getComputedStyle(textarea).lineHeight);
  textarea.style.height = "auto";
  const sizing = composerHeightForContent({
    scrollHeight: textarea.scrollHeight,
    lineHeight
  });
  setTextareaStyle({ height: `${sizing.height}px`, overflowY: sizing.overflowY });
}, [value]);
```

Pass `ref={textareaRef}` and `style={textareaStyle}` to the Chat textarea. Add a layout-width `ResizeObserver` for the field only if manual resizing shows wrapped lines do not recalculate on window width change; disconnect it in cleanup.

In `writer-chat-welcome.css`, remove intrinsic sizing from only this Chat textarea and add:

```css
.writer-chat-welcome-input {
  field-sizing: fixed;
  transition: height 150ms cubic-bezier(0.32, 0.72, 0, 1);
}
```

Run:

```bash
npm run test --workspace @writer/desktop -- writer-chat-composer-sizing.test.ts
npm run typecheck --workspace @writer/desktop
```

Expected: PASS.

- [ ] **Step 2.4: Confirm existing footer scroll policy remains narrow**

Inspect the existing `ResizeObserver` in `use-paste-text-chat-runtime.ts`. Preserve this condition:

```ts
if (!stickToBottomRef.current) {
  return;
}
scrollToEnd("message");
```

If no code change is required, record that decision in the Linear comment and manual evidence rather than adding plumbing. If a change is required for final-settle correction, write a failing scroll-policy test first, then make the smallest change.

- [ ] **Step 2.5: Update OpenSpec and Linear evidence**

Mark `tasks.md` items `5.1` (sizing portion) and `5.3` complete after tests and targeted smoke pass. Add evidence to WRI-155 and move it from `In Progress` to `Done` only after the interaction is verified.

---

## Task 3: Integrated Styling, Verification, and Tracking (WRI-149)

**Files:**
- Modify: `apps/desktop/src/styles/writer-chat-welcome.css`
- Modify: `openspec/changes/paste-text-chat-runtime-shell/tasks.md`
- Modify: `openspec/changes/paste-text-chat-runtime-shell/verify.md`
- Modify: `docs/linear-openspec-map.md`

- [ ] **Step 3.1 (Red): Add reduced-motion and entry-style source assertions**

Extend `composer-motion.test.ts` with narrow stylesheet contract assertions:

```ts
const chatCss = readFileSync(
  new URL("../styles/writer-chat-welcome.css", import.meta.url),
  "utf8"
);

it("defines reduced-motion fallbacks for composer transitions", () => {
  expect(chatCss).toContain("@media (prefers-reduced-motion: reduce)");
  expect(chatCss).toContain(".writer-chat-composer-motion-dock");
  expect(chatCss).toContain(".writer-chat-welcome-input");
});
```

Run: `npm run test --workspace @writer/desktop -- composer-motion.test.ts`

Expected: FAIL until all motion selectors and fallbacks are in place.

- [ ] **Step 3.2 (Green): Finish scoped CSS and reduced-motion fallback**

Complete CSS scoped under Chat selectors:

```css
.writer-chat-user-bubble--entering {
  animation: writer-chat-user-enter 180ms cubic-bezier(0.23, 1, 0.32, 1) 70ms both;
}

@keyframes writer-chat-user-enter {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .writer-chat-composer-motion-dock,
  .writer-chat-welcome-input {
    transition: none;
  }

  .writer-chat-user-bubble--entering {
    animation: none;
  }
}
```

Ensure no `transition: all`, bounce, or global `Textarea` styling is introduced.

- [ ] **Step 3.3: Run full automated verification**

Run:

```bash
npm run typecheck
npm run test --workspace @writer/desktop
openspec validate paste-text-chat-runtime-shell --type change --strict
```

Expected: all pass. Record the exact counts/results in `verify.md`.

- [ ] **Step 3.4: Perform visual/manual verification**

Launch the desktop app and verify:

1. Welcome phase shows centered Composer.
2. First send retains focus/object continuity while moving to the bottom dock; optimistic user bubble enters naturally.
3. New Chat reverses the motion without stale content.
4. Type and delete drafts across 1 through 5 visible lines; input grows and shrinks smoothly.
5. Enter more than 5 lines; input internally scrolls and remains capped.
6. Scroll up in message history, then resize draft; history does not jump to bottom.
7. Enable reduced-motion emulation and repeat first-send/resize behavior; functional states remain correct without interpolation.

Update the manual checklist in `verify.md` with observed results.

- [ ] **Step 3.5: Complete tracking evidence**

Check off `tasks.md` items `5.4`, `5.5`, and `5.6` when corresponding evidence exists. Add result comments to WRI-154, WRI-155, and WRI-149; mark WRI-149 and parent WRI-145 complete only after OpenSpec verification/retrospective/archive requirements are met.

---

## Final Review

- [ ] Confirm every new requirement in `specs/paste-text-chat-runtime/spec.md` and `specs/desktop-shell/spec.md` has implementation and verification evidence.
- [ ] Confirm `rg -n "TBD|TODO|implement later|transition: all" apps/desktop/src openspec/changes/paste-text-chat-runtime-shell` does not reveal unresolved motion work.
- [ ] Confirm no `@assistant-ui/*` or new daemon/API dependency was added.
- [ ] Use `openspec-verify-change` after the implementation tasks are complete, then follow the schema retrospective/archive sequence before opening a PR.
