# Code Quality Audit — Security, Robustness, Efficiency

**Date:** 2026-06-09
**Branch reviewed:** `main`
**Scope:** Full codebase — `apps/daemon`, `apps/desktop` (Electron), `packages/*` (~35k LOC)
**Method:** Parallel subsystem identification → line-level verification → adversarial cross-check of every finding.

> **Status:** Findings logged, not yet fixed. Severities below are post-verification.

---

## Headline

The high-severity findings hold. The cross-check **downgraded 4 items** that were initially overstated (E1 framing, E2, R2, V6) and **tightened preconditions** on two others (V2, V5). Net: fewer false alarms, same top priorities.

The Electron shell itself is hardened (`contextIsolation` on, `nodeIntegration` off, fixed preload surface, local-only content, `setWindowOpenHandler` denies child windows). The core weakness is that **the daemon trusts its local network completely** (V1), which turns several otherwise-local issues into remotely-triggerable ones.

---

## Security

| # | Finding | Verdict | Cross-check evidence |
|---|---------|---------|----------------------|
| **V1** | No auth / Host / Origin check on daemon | ✅ **CONFIRMED — HIGH** | Re-read `apps/daemon/src/router.ts:36-54`, `server.ts:19`, `http.ts:3-16`: CORS response headers only, no Host-header allowlist, body parsed regardless of `Content-Type`. Enables CSRF (state-changing) and DNS-rebinding (full read). Root-cause amplifier for V2/V3/V4. |
| **V2** | Echo adapter → RCE (Windows) | ✅ **CONFIRMED — HIGH** (precondition tightened) | `apps/daemon/src/agents.ts:156-180` `resolveAdapterForRun` has no `isKnownAdapterId` gate; `echo` is registered (`agents.ts:93`); `POST /agents/runs` (`routes/platform.ts:173-175`) passes body `adapterId`. `echo-adapter.ts:19-23` runs `spawn(cmd.exe, ["/c","echo", prompt])` with no metacharacter escaping. cmd.exe quote-break (spawn without `shell:true` → Node's `\"` escaping not honored by cmd.exe) is genuinely exploitable. **Precondition:** needs a valid `sessionId` (randomUUID, unguessable) → remote exploitation requires DNS-rebinding to read a created id; blind CSRF alone can't reach it. |
| **V3** | Arbitrary file read via paste-text `filePath` | ✅ **CONFIRMED — HIGH** | `apps/daemon/src/paste-text.ts:134-169` passes request `filePath` straight to `readFile(...)` and returns full contents. Schema is `filePath: z.string().min(1)` (`packages/contracts/src/paste-text.ts:84`) — zero confinement. Route: `routes/review.ts:402-414`. |
| **V4** | Screenshot path traversal | ✅ **CONFIRMED — MEDIUM** | `apps/daemon/src/figma-screenshots.ts:115-122` + route `routes/review.ts:485-499`. `decodeURIComponent` runs after the `[^/]+` regex match, so `%2f`→`/` traverses. Constraint re-confirmed: path always gets `.png` appended → limited to `*.png` files, not arbitrary read. |
| **V5** | Unvalidated `shell.openExternal` | ✅ **CONFIRMED — MEDIUM** | `apps/desktop/electron/main.cjs:53-56` (+ `setWindowOpenHandler` `:18-21`), no scheme allowlist. `agents-panel.tsx:501-504`: `result.authorizationUrl` from the MCP OAuth flow → `openExternal`, i.e. remote-influenced. **Precondition:** user connects a malicious/compromised MCP server; then `file://`/UNC/custom schemes reach the OS shell. |
| **V6** | Arbitrary write via `save-text-file` IPC | ⚠️ **DOWNGRADED — MEDIUM → LOW** | `apps/desktop/electron/main.cjs:151-154` writes renderer-supplied path+content unconfined. Reachability requires renderer code-execution, which the hardened Electron config otherwise prevents. Pure defense-in-depth, not independently exploitable. |

---

## Robustness

| # | Finding | Verdict | Cross-check evidence |
|---|---------|---------|----------------------|
| **R1** | Download resume corruption | ✅ **CONFIRMED — MEDIUM** | `apps/daemon/src/local-models.ts:257-270`. Two sub-cases verified: (a) no check that a resume got HTTP **206** before appending — a **200** appends a full body to the partial; (b) store `downloadedBytes` (saved every 2s) under-counts the actual `.tmp` size after a mid-download error/crash → duplicated bytes. SHA guard prevents a *bad install* (so not HIGH) but the user re-downloads the whole multi-GB file. |
| **R2** | "Silent save failures" | ❌ **RETRACTED → LOW** | **Original claim was wrong.** `save()` returns the rejecting promise (`packages/storage/src/store.ts:178`); `.catch(()=>undefined)` only protects *chain continuation*, not the awaited caller. Grep found exactly **one** fire-and-forget save (`apps/daemon/src/review.ts:239`); everything else `await`s and propagates errors. Residual: that one site + no central error surface. Minor. |
| **R3** | Resident runtime not keyed on model path | ✅ **CONFIRMED — LOW** | `packages/agent-adapters/src/adapters/local-gemma-adapter.ts:24` caches on first call, ignores later `modelPath`; `resetModelDownload` doesn't evict it. Practically unreachable (VRAM fixed per machine). |

---

## Efficiency

| # | Finding | Verdict | Cross-check evidence |
|---|---------|---------|----------------------|
| **E1** | Whole-store rewrite per mutation | ✅ **CONFIRMED — recalibrated 🔴→ MEDIUM** | `packages/storage/src/store.ts:175-188`: whole snapshot, `JSON.stringify(…, null, 2)`, full-file write; `auditLog` capped at 10k (`store.ts:253`) and included in every write. **Framing correction:** saves fire at user-action/lifecycle frequency (not per-keystroke); cost reaches a few MB/save only once the audit log is large (~5k+ runs). Fix: compact JSON + debounce + split append-only logs. |
| **E2** | `detect()` spawns subprocess per agents poll | ⚠️ **DOWNGRADED — MEDIUM → LOW** | **Frequency claim was wrong.** `/agents` is **not** polled — `listAgents()` is a one-shot effect (`apps/desktop/src/workspace-context.tsx:519-524`). The uncached `listGpuDevices()` spawn in `detect()` (`local-gemma-adapter.ts:270`) is real waste vs the cached `detectNvidiaVram()` (`:188`), but mount/refresh-frequency, not a per-second storm. |
| **E3** | 100ms run poll, no overlap guard, duplicated | ✅ **CONFIRMED — MEDIUM** | Directly verified: `setInterval(poll, 100)` calling `getAgentRun` 10×/s while a run is pending (`apps/desktop/src/paste-text-chat-panel.tsx:159`), no in-flight guard; a parallel 500ms implementation exists (`paste-text-chat-runtime/use-paste-text-run-sync.ts:88`). |
| **E4** | Per-chunk awaited write in download | ✅ **CONFIRMED — LOW** | `apps/daemon/src/local-models.ts:284` awaits a Promise per chunk. Correct; `stream/promises pipeline()` would be cleaner. Minor. |

---

## Revised priority list (post-verification)

1. **V1** — daemon auth token + Host/Origin checks (HIGH; also gates V2/V3/V4 remote reach)
2. **V2** — gate `resolveAdapterForRun` on `isKnownAdapterId` + escape echo's cmd.exe args (HIGH)
3. **V3** — confine paste-text `filePath` to an allowed root (HIGH)
4. **E3** — fix the 100ms / duplicated run poll: raise interval, add in-flight guard, dedupe (MEDIUM, easy win)
5. **E1** — compact JSON + debounce saves (MEDIUM)
6. **R1** — download resume: derive offset from `stat(tmp)`, require 206 to append (MEDIUM)
7. Lower: V4, V5, E2, E4, R2, R3, V6

## User-visible impact (for prioritization)

- **Directly felt by users:** R1 (interrupted download restarts from scratch), E3 (battery/CPU drain during runs), E1 (app slows as the store grows over months), E2 (minor lag opening the LLM panel).
- **Invisible in normal use:** all security findings V1–V6 (only manifest under attack), R2, R3, E4.
- **A *fix* with UX blast radius:** V1's auth token — done carelessly it can make the app look dead on launch (reused daemon with mismatched token) or break screenshot thumbnails (`<img src>` can't carry an auth header). Both avoidable; risk is in our code, not the user's network/environment.

## What's already solid (acknowledged)

- Electron shell hardening (contextIsolation, no nodeIntegration, fixed preload, deny child windows, no `dangerouslySetInnerHTML`).
- Atomic persistence (tmp-write + rename; `saveChain` serializes writes).
- Download integrity (SHA-256 verification + atomic rename + abort handling).
- Runtime hygiene (idle eviction, turn-count bounding, KV/draft VRAM fallbacks).
- Load-time zod validation with `safeParse` fallbacks for drift-prone fields.
