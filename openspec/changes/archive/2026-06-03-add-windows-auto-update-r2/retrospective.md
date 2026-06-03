# Retrospective: add-windows-auto-update-r2

> Written: 2026-06-03 (after verify passed)
> Commit range: `838cb1e0..a387e1f`
> Worktree: in-place on `feat/hot-update`

---

## 0. Evidence

- **Commit range**: `838cb1e0..a387e1f` (10 commits)
- **Diff size**: +559 / -20 lines across 20 files
- **Tasks done**: 15/16 (`6.4` manual E2E pending — requires packaged build + R2)
- **Active hours**: ~1.5 hours (single session, 2026-06-03)
- **Subagent dispatches**: ~28 (6 implementers + 2 fix agents + 6 spec reviewers + 6 quality reviewers + 1 final reviewer + re-reviews)
- **New external dependencies**: `electron-updater@^6.8.3` (MIT, runtime dep of `@writer/desktop`)
- **Bugs encountered post-merge**: 0 (all caught pre-merge by review pipeline)
- **OpenSpec validate state at archive**: PASS (`Change 'add-windows-auto-update-r2' is valid`)
- **Test coverage signal**: contracts 77/77 (+5 new), desktop 134/134 (+14 new)

Commit chain:

```
838cb1e0 [baseline — pre-WRI-223]
02bf874  feat(contracts): add app update state schema (WRI-223)
d2d083b  fix(contracts): tighten percent to int, add downloaded test (WRI-223)
b9ac220  build(desktop): NSIS generic R2 publish + preserve app data (WRI-223)
b4a5abd  feat(desktop): main-process auto-updater wiring (WRI-223)
c62e173  feat(desktop): preload writerUpdate bridge + typings (WRI-223)
57c8f0e  feat(desktop): settings update affordance (WRI-223)
3502fa4  fix(desktop): update-section stale api, idle test, use WriterPrimaryButton (WRI-223)
afeb67a  test(desktop): auto-update guard + verify evidence (WRI-223)
e3b814c  fix(desktop): guard writerUpdate bridge in dev, suppress rejections (WRI-223)
a387e1f  docs(openspec): add spec verification section to verify.md (WRI-223)
```

---

## 1. Wins

- [evidence: `auto-update-state.cjs`, `auto-update-state.test.ts`] Pure-mapper split paid off immediately. The pure `mapUpdaterEvent` function was trivially testable without any Electron mocking. All 6 event branches had green tests before a single line of Electron wiring was written — textbook TDD payoff.

- [evidence: `auto-update.guard.test.ts`] Guard-test-as-compiled-assertion is an unusual but effective pattern. Reading the actual CJS source as text and asserting forbidden substrings means the invariant is enforced in CI without coupling to implementation internals. The final code reviewer flagged it as a strength.

- [evidence: `electron-builder.yml:87` + guard test] Data-survival invariant enforced at two layers: `deleteAppDataOnUninstall: false` in the installer config and the guard test in CI. Belt-and-suspenders matches the risk level.

- [evidence: `preload.cjs` + `writer-desktop.d.ts`] `contextBridge` + optional `writerUpdate?` typing on `Window` followed the existing `writerDesktop` pattern exactly, including the optional marker for dev-mode absence. Clean zero-friction addition to the existing preload.

- [evidence: all tasks] Two-stage review pipeline (spec compliance → code quality) caught 3 Critical and 4 Important issues across 6 tasks, all pre-merge. Zero post-merge bugs.

---

## 2. Misses

- 🟡 [painful | evidence: `e3b814c`] **Preload bridge exposed unconditionally in dev — not in original plan.** `contextBridge.exposeInMainWorld("writerUpdate", {...})` was added without an `app.isPackaged` guard. The main-process guard was in place but the preload had no corresponding check. In dev, `window.writerUpdate` was defined, `UpdateSection` rendered, and button clicks threw `Error: No handler registered for 'writer-update:check'`. The final cross-task code review caught this (C1), requiring a follow-up fix using `additionalArguments` in `createMainWindow.cjs`. The plan's Task 4 description should have explicitly required a dev-mode preload guard.

- 🟡 [painful | evidence: `3502fa4`] **`api` stale-closure in `UpdateSection` — not caught until final review.** `const api = typeof window !== "undefined" ? window.writerUpdate : undefined;` in the render body with `[api]` as a useEffect dep was a Rules-of-Hooks violation and unnecessary SSR guard for an Electron renderer. The per-task code quality review for Task 5 correctly flagged it as Critical but only after the component was already implemented. A more prescriptive plan step (e.g., "use stable reference, no SSR guard in Electron renderer") would have prevented the roundtrip.

- 📌 [nit | evidence: `d2d083b`] **`percent` typed as `z.number()` instead of `z.number().int()`** in initial implementation of `app-update.ts`. The downstream mapper always `Math.floor`s before setting this field, making the schema constraint inconsistent. Caught by Task 1 quality review. Minor, trivially fixed, but indicates the plan spec could have been more explicit about the integer constraint.

---

## 3. Plan deviations

| Plan task | What changed | Why |
|-----------|--------------|-----|
| Task 4 (preload bridge) | Required adding `additionalArguments: ['--is-packaged=${app.isPackaged}']` to `createMainWindow.cjs` and an `isPackaged` guard in `preload.cjs` | Not in original plan; caught by final code review (C1). The plan's `initAutoUpdate` guard covered the main process but left the preload bridge unguarded. |
| Task 5 (update-section) | `useEffect` dep changed from `[api]` to `[]`; removed SSR guard; used `WriterPrimaryButton` instead of raw `<button>`; extended disabled to cover `downloading` | Code quality review flagged stale closure (Critical) and button pattern inconsistency (Important). The plan spec didn't prescribe these Electron/React idioms explicitly. |
| Task 1 (contracts) | Added 5th test for `downloaded` state; changed `percent` to `.int()` | Code quality review identified gaps not in the plan's 4-test spec. |

---

## 4. Skill / workflow compliance

| Skill | Used |
|-------|------|
| superpowers:brainstorming | ✓ (prior session — brainstorm.md exists) |
| superpowers:writing-plans | ✓ (prior session — plan.md exists) |
| superpowers:using-git-worktrees | ✓ (invoked; user elected to work in-place on `feat/hot-update`) |
| superpowers:subagent-driven-development | ✓ |
| (transitive) superpowers:test-driven-development | ✓ (each subagent followed RED→GREEN for all new files) |
| (transitive) superpowers:requesting-code-review | ✓ (spec + quality review after each task; re-review after fixes) |
| superpowers:finishing-a-development-branch | ⏳ (next step — PR not yet opened) |

### Deliberately Skipped Skills

_(No skills were skipped. `finishing-a-development-branch` is in progress as the next step after retrospective + archive.)_

---

## 5. Surprises

- **Preload doesn't inherit `app.isPackaged`** — Preload scripts run in the renderer process; `app` from Electron is not importable there. The workaround (`additionalArguments` in `webPreferences`) was not documented in the plan and required reading `createMainWindow.cjs` to discover the right injection point. This is a known Electron quirk but worth noting for any future main→preload capability flag.

- **`contextBridge.exposeInMainWorld` has no dev/prod branching built in** — Unlike `app.isPackaged` which is a first-class Electron API, there is no equivalent in the preload context without explicit plumbing from the main process. The guard pattern (`process.argv.includes('--is-packaged=true')`) is the idiomatic workaround.

- **Two pre-existing test failures in `@writer/daemon` and `@writer/agent-adapters`** — `normalizeDevinModelId` fallback changed from `swe-1.6` to `gpt-5.4` in both packages, causing unrelated test failures. These pre-date WRI-223 and were present on the branch before the first commit.

---

## 6. Promote candidates → long-term learning

- [ ] 🟡 **Always add a preload isPackaged guard when the feature is production-only** → **Promote to project CLAUDE.md** (`apps/desktop/CLAUDE.md` — Electron conventions section)
  > **Why**: `contextBridge.exposeInMainWorld` in preload runs unconditionally; the `app.isPackaged` guard in the main process does not protect the renderer from seeing the bridge. The WRI-223 review caught this as Critical (C1) after all 6 implementation tasks were complete — a costly fix relative to a one-line plan note.
  > **How to apply**: Whenever a plan task says "expose X via contextBridge" and X is guarded by `app.isPackaged` in main, the preload task must explicitly include: "guard with `process.argv.includes('--is-packaged=true')` and add `additionalArguments` in `createMainWindow.cjs`."

- [ ] 🟡 **In Electron renderer components, read bridge globals once (stable ref), never in render body with `useEffect` deps** → **Promote to project CLAUDE.md** (`apps/desktop/CLAUDE.md` — React + Electron patterns)
  > **Why**: `window.writerUpdate` accessed in render body created a stale-closure / Rules-of-Hooks issue that required a fix commit. In Electron, preload globals are set before first render and never change; reading them in the render body is unnecessary and creates dep-array noise.
  > **How to apply**: For any `window.writerDesktop.*` or `window.writerUpdate.*` access in a component, read directly without `typeof window` guard and use `[]` as useEffect deps.

- [ ] 📌 **Plan specs for Zod schemas should explicitly state integer vs float for bounded numbers** → **Promote to memory** (type: feedback, affects openspec plan writing)
  > **Why**: `percent: z.number().min(0).max(100)` was written as float in the initial implementation because the plan said "number(0-100)" without specifying int. The downstream mapper always floors it, so the schema and mapper were inconsistent until caught by code review.
  > **How to apply**: When writing tasks.md for Zod schemas, any numeric field that will be floored/rounded before storage should be specified as `z.number().int()` in the plan step, not left as `z.number()`.
