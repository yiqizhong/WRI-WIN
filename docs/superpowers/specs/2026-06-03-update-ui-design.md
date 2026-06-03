# Update UI Design

**Date:** 2026-06-03  
**Status:** Approved  
**Replaces:** `UpdateSection` in Settings → LLM & MCP tab

---

## Overview

When an update is available, Writer shows a persistent pill button in the title bar (left of the settings gear). Clicking it opens a modal that walks the user through download and restart. Dismissing the modal never cancels or hides the update — the pill stays visible until the app restarts.

---

## Top-Bar Pill Button

A new `UpdatePill` component rendered inside `writer-masthead__buttons`, immediately left of the settings icon.

**Visibility:** Only rendered when `window.writerUpdate` is defined and the update state is `available`, `downloading`, `downloaded`, or `error`. Hidden for `idle`, `checking`, and `not-available`.

**States:**

| State | Label | Style |
|-------|-------|-------|
| `available` | `↑ Upgrade` | Blue pill (primary button color) |
| `downloading` | `Downloading…` + spinner | Muted/gray |
| `downloaded` | `Update ready` | Green pill |
| `error` | `Update failed` | Muted/warning style |

Clicking the pill at any visible state opens (or re-opens) the modal.

---

## Update Modal

A new `UpdateModal` component wrapping `WriterModal`. Body and footer swap per state; title and content are latched via `useModalLatch` through the exit animation.

### Available
- **Title:** `Writer 0.x.x is available`
- **Body:** `A new version of Writer is ready to download. This won't delete any of your data.`
- **Footer:** `Not now` (secondary) · `Upgrade` (primary → calls `api.download()`)

### Downloading
- **Title:** `Downloading update…`
- **Body:** Progress bar + `42% · 234 MB / 553 MB` label, updated via `percent` from state
- **Footer:** `Later` (secondary — dismisses modal; download continues in background)
- No cancel: once a download starts it runs to completion.

### Downloaded
- **Title:** `Update ready`
- **Body:** `Writer will restart and reopen automatically.`
- **Footer:** `Later` (secondary) · `Restart to install` (primary → calls `api.restartToInstall()`)

### Error
- **Title:** `Update failed`
- **Body:** Error message string from `state.message`
- **Footer:** `Dismiss` (secondary) · `Try again` (primary → calls `api.check()`)

---

## Data Flow

**State ownership:** `AppShell.tsx` subscribes to `window.writerUpdate.onState` once on mount and stores `updateState` in local React state. It passes `updateState` and `onUpdateClick` to `WindowMasthead`, and renders `<UpdateModal>` as a sibling alongside all screens.

**Modal open/closed** is a separate boolean in `AppShell`. Clicking the pill sets it to `true`; dismissing (X, "Not now", "Later") sets it to `false`. Update state is never affected by modal visibility.

**Auto-open:** When state transitions to `available` or `error` for the first time in a session (previous state was `idle`, `checking`, or `not-available`), the modal opens automatically so the user is notified without needing to spot the pill.

**Download continuation:** If the modal is dismissed during `downloading`, the download continues in background. The pill label updates to `Downloading…`. When the download completes, the pill updates to `Update ready` and the modal can be reopened to restart.

---

## Files

| Action | File |
|--------|------|
| New | `apps/desktop/src/components/writer/UpdateModal.tsx` |
| Edit | `apps/desktop/src/shell/WindowMasthead.tsx` — add `UpdatePill` |
| Edit | `apps/desktop/src/shell/AppShell.tsx` — subscribe to update state, render modal |
| Edit | `apps/desktop/src/components/writer/writer-settings-tabs.tsx` — remove `<UpdateSection />` |
| Delete | `apps/desktop/src/components/writer/update-section.tsx` |
| Delete | `apps/desktop/src/components/writer/update-section.test.tsx` |

---

## Out of Scope

- Changelog / release notes in the modal (can be added later)
- Download cancellation
- Auto-download on update detection
