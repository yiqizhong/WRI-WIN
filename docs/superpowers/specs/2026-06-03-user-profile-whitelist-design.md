# User Profile & Whitelist Login

**Date:** 2026-06-03
**Status:** Approved

## Overview

First-time users are shown a name-entry screen before the home screen. They enter their name, the daemon validates it against a hardcoded whitelist, and on success the name is saved permanently to the platform store. Subsequent launches skip the screen entirely and show the personalized home greeting.

## Goals

- Gate access to a known set of users without a real auth system.
- Persist the name so the user never sees the entry screen again (unless they reinstall).
- Personalize the home screen greeting with the saved name.

## Non-Goals

- Remote whitelist sync (hardcoded for now; can be replaced later).
- Multiple profiles or account switching.
- Password or credential-based authentication.

## Architecture

### 1. Platform Store — `userProfile`

Add a new optional field to `PlatformStoreSnapshot` in `packages/storage/src/store.ts`:

```ts
userProfile: { name: string } | null
```

- Default: `null` (first launch).
- Persisted in `~/.writer/platform-store.json`.
- Read on daemon startup; exposed via the `/platform` route.

### 2. Daemon — whitelist & profile route

**Whitelist:** a hardcoded string array in the daemon (e.g. `apps/daemon/src/profile.ts`):

```ts
const WHITELIST = [
  "Jair", "Brenda", "Christopher", "Mallory", "Michelle",
  "Jorge", "Scott", "Alexis", "Aylin", "Vicky",
  "Greg", "Danielle", "Lucy", "Kathryn", "Martin",
  "Jaegon", "Elliot", "Amy", "Yiqi"
]; // case-insensitive match (Michelle appears once; duplicate removed)
```

**New route:** `POST /profile/setup`

- Request body: `{ name: string }`
- Logic: trim + lowercase the input, compare against lowercased whitelist entries.
- Success (200): save `{ name: trimmed }` to `PlatformStore`, return `{ profile: { name } }`.
- Failure (400): return `{ error: "Name not recognized." }`.

**Existing route:** `GET /platform` (already exists) — extend its response to include `userProfile: { name: string } | null`.

### 3. Renderer — `NameEntryScreen`

New screen at `apps/desktop/src/screens/name-entry-screen.tsx`:

- Full-screen, no navigation bar.
- Single text input ("Your name") + "Continue" button.
- Enter key submits (reuses the existing Enter-to-submit pattern).
- On submit: calls `daemonClient.setupProfile({ name })`.
- On success: workspace context updates `userProfile`, router navigates to `/`.
- On error: shows an `InlineAlert kind="error"` with "Name not recognized, please try again." Input stays focused.

### 4. Router — gate on profile

In `apps/desktop/src/app.tsx`:

- On app load, workspace context reads `userProfile` from the daemon's platform response.
- If `userProfile === null` and daemon is connected → render `<NameEntryScreen />` instead of the normal routes.
- If daemon is not yet connected (checking) → show a loading state (existing pattern).
- Once profile is set → normal routing resumes.

### 5. Home screen — personalized greeting

Update `apps/desktop/src/screens/home-screen.tsx`:

```tsx
// Before:
<span>Hi,</span>
<span>{greeting()}</span>

// After:
<span>Hi {name},</span>
<span>{greeting()}</span>
```

`name` is passed from the workspace context (or home screen props). The `greeting()` function is unchanged.

## Data Flow

```
App start
  └─ workspace loads platform state (GET /platform)
       ├─ userProfile: null  →  show NameEntryScreen
       │    └─ user submits name
       │         └─ POST /profile/setup { name }
       │              ├─ match: save, return profile → navigate to /
       │              └─ no match: show inline error, stay on screen
       └─ userProfile: { name }  →  show home screen with "Hi [name],"
```

## Error Handling

- **Wrong name:** inline error, input stays editable, no retry limit.
- **Daemon not reachable:** NameEntryScreen is not shown (daemon-down state is handled by the existing workspace loading flow).
- **Name already set:** the entry screen never renders; profile state is immutable from the UI (no "change name" feature in scope).

## Whitelist Management

The whitelist is a hardcoded array in the daemon source. To add or remove names, edit the array and ship a new build. A remote-fetch upgrade path is out of scope for now.

## Files Changed

| File | Change |
|------|--------|
| `packages/storage/src/store.ts` | Add `userProfile` field to snapshot |
| `packages/contracts/src/` | Add `UserProfile` type + `setupProfileSchema` |
| `apps/daemon/src/profile.ts` | New: whitelist + `setupProfile` handler |
| `apps/daemon/src/routes/platform.ts` | Expose `userProfile` in GET response |
| `apps/daemon/src/index.ts` | Register `POST /profile/setup` route |
| `apps/desktop/src/screens/name-entry-screen.tsx` | New: name entry UI |
| `apps/desktop/src/app.tsx` | Gate routing on profile presence |
| `apps/desktop/src/workspace-context.tsx` | Load + expose `userProfile` |
| `apps/desktop/src/daemon-client.ts` | Add `setupProfile` method |
| `apps/desktop/src/screens/home-screen.tsx` | Personalize greeting |
