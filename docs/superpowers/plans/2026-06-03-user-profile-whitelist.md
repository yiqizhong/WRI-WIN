# User Profile & Whitelist Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On first launch, show a name-entry screen that validates the user's name against a hardcoded whitelist, saves it to the platform store, and personalizes the home screen greeting.

**Architecture:** Add `userProfile: { name: string } | null` to `PlatformStore` and expose it via `GET /workspace`. A new `POST /profile/setup` route validates the name against a hardcoded whitelist and saves it. The renderer gates routing on profile presence and passes the name to the home screen.

**Tech Stack:** TypeScript, Zod (contracts), Node.js HTTP (daemon), React + react-router-dom (renderer)

---

### Task 1: Add UserProfile to contracts + workspace schema

**Files:**
- Modify: `packages/contracts/src/workspace.ts`

- [ ] **Step 1: Add `userProfile` to `workspaceInfoSchema`**

Replace the content of `packages/contracts/src/workspace.ts`:

```ts
import { z } from "zod";

import { productPackageListItemSchema } from "./guideline";

export const userProfileSchema = z.object({
  name: z.string().min(1)
});

export const workspaceInfoSchema = z.object({
  projectId: z.string().min(1),
  lastProductId: z.string().min(1).nullable(),
  products: z.array(productPackageListItemSchema),
  userProfile: userProfileSchema.nullable()
});

export type UserProfile = z.infer<typeof userProfileSchema>;
export type WorkspaceInfo = z.infer<typeof workspaceInfoSchema>;

export function parseWorkspaceInfo(payload: unknown): WorkspaceInfo {
  return workspaceInfoSchema.parse(payload);
}
```

- [ ] **Step 2: Export new types from contracts index**

In `packages/contracts/src/index.ts`, find the existing workspace export line:
```ts
export { parseWorkspaceInfo, workspaceInfoSchema } from "./workspace";
export type { WorkspaceInfo } from "./workspace";
```
Replace with:
```ts
export { parseWorkspaceInfo, userProfileSchema, workspaceInfoSchema } from "./workspace";
export type { UserProfile, WorkspaceInfo } from "./workspace";
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: errors in `apps/daemon/src/workspace.ts` (missing `userProfile` in return value) — that's expected and will be fixed in Task 3.

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/src/workspace.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): add UserProfile type to WorkspaceInfo schema"
```

---

### Task 2: Add userProfile to PlatformStore

**Files:**
- Modify: `packages/storage/src/store.ts`

- [ ] **Step 1: Add `userProfile` to the snapshot type and default**

In `packages/storage/src/store.ts`, import `UserProfile` from contracts:

Find the existing imports from `@writer/contracts` (around line 10) and add `UserProfile` to the import list:
```ts
  type UserProfile,
```

Find `PlatformStoreSnapshot` type (around line 59) and add the field:
```ts
  userProfile: UserProfile | null;
```

Find the constructor default snapshot (around line 95) and add:
```ts
      userProfile: null,
```

- [ ] **Step 2: Load userProfile from disk**

In the `load()` method, inside the `this.snapshot = { ... }` block (around line 121), add after `devinProviderSettings`:
```ts
        userProfile: (() => {
          const raw = (parsed as { userProfile?: unknown }).userProfile;
          if (!raw) return null;
          const r = userProfileSchema.safeParse(raw);
          return r.success ? r.data : null;
        })(),
```

Also add the import for `userProfileSchema` to the `@writer/contracts` import list:
```ts
  userProfileSchema,
```

- [ ] **Step 3: Add getter and setter methods**

After the `setSpeculativeDecoding` method (around line 415), add:
```ts
  getUserProfile(): UserProfile | null {
    return this.snapshot.userProfile ? { ...this.snapshot.userProfile } : null;
  }

  setUserProfile(profile: UserProfile): void {
    this.snapshot.userProfile = userProfileSchema.parse(profile);
  }
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: still errors in daemon workspace.ts — that's fine.

- [ ] **Step 5: Commit**

```bash
git add packages/storage/src/store.ts
git commit -m "feat(storage): add userProfile field to PlatformStore"
```

---

### Task 3: Daemon — whitelist module + profile route

**Files:**
- Create: `apps/daemon/src/profile.ts`
- Modify: `apps/daemon/src/workspace.ts`
- Modify: `apps/daemon/src/routes/platform.ts`

- [ ] **Step 1: Write tests for the whitelist validator**

Create `apps/daemon/src/profile.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateWhitelistName } from "./profile";

describe("validateWhitelistName", () => {
  it("accepts an exact name", () => {
    expect(validateWhitelistName("Yiqi")).toBe("Yiqi");
  });

  it("is case-insensitive", () => {
    expect(validateWhitelistName("yiqi")).toBe("Yiqi");
    expect(validateWhitelistName("YIQI")).toBe("Yiqi");
  });

  it("trims whitespace", () => {
    expect(validateWhitelistName("  Yiqi  ")).toBe("Yiqi");
  });

  it("returns null for unknown names", () => {
    expect(validateWhitelistName("Unknown")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(validateWhitelistName("")).toBeNull();
    expect(validateWhitelistName("   ")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm --workspace @writer/daemon run test -- --reporter=verbose profile
```
Expected: FAIL — `validateWhitelistName` not found.

- [ ] **Step 3: Create `apps/daemon/src/profile.ts`**

```ts
import type { DaemonState } from "./state";

const WHITELIST = [
  "Jair", "Brenda", "Christopher", "Mallory", "Michelle",
  "Jorge", "Scott", "Alexis", "Aylin", "Vicky",
  "Greg", "Danielle", "Lucy", "Kathryn", "Martin",
  "Jaegon", "Elliot", "Amy", "Yiqi"
];

/**
 * Validates a name against the whitelist (case-insensitive, trimmed).
 * Returns the canonical (correctly-cased) name on match, null otherwise.
 */
export function validateWhitelistName(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  return WHITELIST.find((n) => n.toLowerCase() === lower) ?? null;
}

export async function setupUserProfile(
  state: DaemonState,
  input: unknown
): Promise<{ name: string }> {
  const body = input as { name?: unknown };
  const raw = typeof body?.name === "string" ? body.name : "";
  const canonical = validateWhitelistName(raw);

  if (!canonical) {
    throw new Error("Name not recognized.");
  }

  state.store.setUserProfile({ name: canonical });
  await state.store.save();
  return { name: canonical };
}
```

- [ ] **Step 4: Run tests — they should pass now**

```bash
npm --workspace @writer/daemon run test -- --reporter=verbose profile
```
Expected: PASS (5 tests).

- [ ] **Step 5: Include `userProfile` in `getWorkspaceInfo`**

In `apps/daemon/src/workspace.ts`, change the return block:
```ts
  return {
    projectId: project.id,
    lastProductId: project.activeProductId ?? null,
    products: apiTree.products,
    userProfile: state.store.getUserProfile()
  };
```

- [ ] **Step 6: Add `POST /profile/setup` route to platform router**

In `apps/daemon/src/routes/platform.ts`, add the import at the top:
```ts
import { setupUserProfile } from "../profile";
```

Then, just before `return false;` at the end of `handlePlatformRequest` (around line 449), add:
```ts
  if (request.method === "POST" && path === "/profile/setup") {
    try {
      const result = await setupUserProfile(state, await readJsonBody(request));
      sendJson(response, 200, result);
    } catch (error) {
      invalidRequest(
        response,
        error instanceof Error ? error.message : "Could not save profile.",
        "Enter a name from the approved list."
      );
    }
    return true;
  }
```

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add apps/daemon/src/profile.ts apps/daemon/src/profile.test.ts apps/daemon/src/workspace.ts apps/daemon/src/routes/platform.ts
git commit -m "feat(daemon): whitelist profile validation and setup route"
```

---

### Task 4: DaemonClient — add setupProfile method

**Files:**
- Modify: `apps/desktop/src/daemon-client.ts`

- [ ] **Step 1: Add `UserProfile` import and `setupProfile` to the client**

In `apps/desktop/src/daemon-client.ts`, add to the contracts import list:
```ts
  userProfileSchema,
  type UserProfile,
```

Inside `createDaemonClient`'s return object, alongside the other POST methods (e.g. near `createFigmaSession`), add:
```ts
    setupProfile: (name: string) =>
      request(
        baseUrl,
        "/profile/setup",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name })
        },
        (payload) => userProfileSchema.parse(payload)
      ),
```

`DaemonClient` is the inferred return type of `createDaemonClient`, so no separate interface change is needed.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/daemon-client.ts
git commit -m "feat(client): add setupProfile method to DaemonClient"
```

---

### Task 5: WorkspaceContext — expose userProfile

**Files:**
- Modify: `apps/desktop/src/workspace-context.tsx`

- [ ] **Step 1: Add `UserProfile` import**

In `apps/desktop/src/workspace-context.tsx`, add `UserProfile` to the contracts imports:
```ts
  type UserProfile,
```

- [ ] **Step 2: Add `userProfile` state**

Inside `WorkspaceProvider`, after the existing `useState` declarations (around line 111), add:
```ts
  const [userProfile, setUserProfile] = useState<UserProfile | null | "loading">("loading");
```

(`"loading"` distinguishes "not yet fetched" from "fetched and null".)

- [ ] **Step 3: Set userProfile when workspace loads**

Find the `useEffect` that calls `daemonClient.getWorkspace()` (around line 479). Inside the async block, after `setSelectedProductIdState(preferred)`, add:
```ts
        setUserProfile(workspace.userProfile);
```

Also add, just before the existing `return` in the `if (!daemonConnected)` branch of the agents `useEffect` (around line 503):
```ts
      setUserProfile("loading");
```

- [ ] **Step 4: Add `userProfile` and `saveProfile` to context value type**

In `WorkspaceContextValue` type (around line 27), add:
```ts
  userProfile: UserProfile | null | "loading";
  saveProfile: (name: string) => Promise<void>;
```

- [ ] **Step 5: Implement `saveProfile` function**

Inside `WorkspaceProvider`, before the context value object, add:
```ts
  async function saveProfile(name: string): Promise<void> {
    const profile = await daemonClient.setupProfile(name);
    setUserProfile(profile);
  }
```

- [ ] **Step 6: Add to context value object**

In the context `value` object (near line 565), add:
```ts
    userProfile,
    saveProfile,
```

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/workspace-context.tsx
git commit -m "feat(renderer): expose userProfile and saveProfile in WorkspaceContext"
```

---

### Task 6: Build NameEntryScreen

**Files:**
- Create: `apps/desktop/src/screens/name-entry-screen.tsx`

- [ ] **Step 1: Create the screen**

Create `apps/desktop/src/screens/name-entry-screen.tsx`:

```tsx
import { useState, type KeyboardEvent } from "react";

import { InlineAlert } from "@/components/writer/inline-alert";
import { WriterFormField, WriterFormInput } from "@/components/writer/writer-form-field";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";
import { GlassCard } from "@/components/writer/glass-card";

import { useWorkspace } from "../workspace-context";
import { DaemonClientError } from "../daemon-client";

export function NameEntryScreen() {
  const { saveProfile } = useWorkspace();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await saveProfile(trimmed);
    } catch (err) {
      setError(
        err instanceof DaemonClientError
          ? err.message
          : "Something went wrong. Please try again."
      );
      setSubmitting(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="writer-home-text writer-home-heading flex flex-col">
          <span>Welcome to Writer.</span>
        </div>

        <GlassCard className="flex flex-col gap-4 p-4">
          <WriterFormField label="Your name" htmlFor="profile-name">
            <WriterFormInput
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your name"
              disabled={submitting}
              autoFocus
            />
          </WriterFormField>

          {error ? (
            <InlineAlert kind="error" title="Name not recognized" subtitle="Please try again." />
          ) : null}

          <div className="flex justify-end">
            <WriterPrimaryButton
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
            >
              {submitting ? "Saving…" : "Continue"}
            </WriterPrimaryButton>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/screens/name-entry-screen.tsx
git commit -m "feat(renderer): add NameEntryScreen for first-launch profile setup"
```

---

### Task 7: Gate routing on profile presence

**Files:**
- Modify: `apps/desktop/src/app.tsx`

- [ ] **Step 1: Add NameEntryScreen import**

In `apps/desktop/src/app.tsx`, add:
```ts
import { NameEntryScreen } from "./screens/name-entry-screen";
```

- [ ] **Step 2: Gate `RoutedApp` on userProfile**

`RoutedApp` is inside `WorkspaceProvider`, so it can call `useWorkspace()`. Replace the existing `RoutedApp` function:

```tsx
function RoutedApp() {
  const { userProfile, daemonState } = useWorkspace();

  // Daemon connected and profile definitively absent → name-entry screen.
  // Only trigger when daemon is healthy (connected/degraded) so that daemon-offline
  // states still fall through to normal routes where existing error UI handles them.
  const daemonHealthy =
    daemonState.kind === "connected" || daemonState.kind === "degraded";
  if (daemonHealthy && userProfile === null) {
    return <NameEntryScreen />;
  }

  // Hide the very brief initial flash (checking + workspace not yet loaded).
  if (daemonState.kind === "checking" && userProfile === "loading") {
    return null;
  }

  return (
    <ProductChrome>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/figma-audit" element={<FigmaAuditScreen />} />
        <Route path="/guide" element={<FigmaGuidelineGeneratorScreen />} />
        <Route path="/guide/log" element={<GuidelinesRouteLayout />}>
          <Route index element={<GuidelinesListScreen />} />
          <Route path=":sessionId" element={<GuidelineDetailScreen />} />
        </Route>
        <Route path="/audits" element={<AuditsRouteLayout />}>
          <Route index element={<AuditsListScreen />} />
          <Route path=":sessionId" element={<AuditDetailScreen />} />
        </Route>
        <Route path="/text-copy" element={<TextCopyScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ProductChrome>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/app.tsx
git commit -m "feat(renderer): gate routing on userProfile — show NameEntryScreen on first launch"
```

---

### Task 8: Personalize home screen greeting

**Files:**
- Modify: `apps/desktop/src/screens/home-screen.tsx`

- [ ] **Step 1: Accept name prop and update greeting**

In `apps/desktop/src/screens/home-screen.tsx`, update the `HomeScreen` component to read the name from workspace context and display it in the greeting.

Add the import at the top:
```ts
import { useWorkspace } from "../workspace-context";
```

Update `HomeScreen`:
```tsx
export function HomeScreen() {
  const navigate = useNavigate();
  const { userProfile } = useWorkspace();
  const name = userProfile && userProfile !== "loading" ? userProfile.name : null;

  return (
    <div className="mt-[76px] flex h-full w-full items-center justify-center">
      <div className="flex -translate-y-[108px] flex-col gap-16">
        <div className="flex flex-col gap-6">
          <div className="writer-home-text writer-home-heading flex flex-col">
            <span>{name ? `Hi ${name},` : "Hi,"}</span>
            <span>{greeting()}</span>
          </div>
          <div className="writer-home-divider" aria-hidden />
        </div>
        {/* rest of JSX unchanged */}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 3: Start the app and verify end-to-end**

```bash
npm run dev:desktop
```

Verify:
1. On first launch (no profile saved) → NameEntryScreen appears.
2. Enter an unknown name (e.g. "Unknown") → red error "Name not recognized".
3. Enter a whitelisted name (e.g. "Yiqi") → navigates to home screen showing "Hi Yiqi, Good evening!".
4. Quit and relaunch → goes straight to home screen, no name entry.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/screens/home-screen.tsx
git commit -m "feat(renderer): personalize home greeting with saved user name"
```
