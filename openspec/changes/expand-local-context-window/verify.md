# Verification Report: expand-local-context-window

## Summary

| Dimension    | Status                                      |
|--------------|---------------------------------------------|
| Completeness | 16/17 tasks ✓ · 4 requirements covered      |
| Correctness  | All 9 spec scenarios implemented            |
| Coherence    | Layer boundaries followed · design adhered  |

**Final assessment:** No critical issues. One expected warning (manual smoke requires live GPU). Ready for archive.

---

## Completeness

**Tasks:** 16/17 complete.

- Tasks 1.1–5.3: ✅ all checked.
- Task 5.4 (manual smoke): ⚠️ not checked — requires live daemon + GPU. Expected; not a code blocker.

**Requirements covered:**

| Spec file                    | Requirement                                    | Status |
|------------------------------|------------------------------------------------|--------|
| agent-adapter-runtime/spec   | Local runtime context window from manifest     | ✅     |
| agent-adapter-runtime/spec   | KV cache precision with VRAM fallback          | ✅     |
| agent-adapter-runtime/spec   | New conversation resets local model context    | ✅     |
| paste-text-chat/spec         | Conversation history in prompt (MODIFIED)      | ✅     |

---

## Correctness

### Requirement: Local runtime context window from manifest

| Scenario                         | Implementation                                                    | Evidence |
|----------------------------------|-------------------------------------------------------------------|----------|
| Context size sourced from manifest | `resolveCtxSize(env, contextSize)` where `contextSize = GEMMA_4_E4B_MANIFEST.defaultContext` (16384) | `local-gemma-runtime.ts:168`, `agents.ts:73-76` |
| Environment override respected   | `WRITER_LOCAL_CTX_SIZE` wins when finite+positive integer        | `local-gemma-runtime.ts:44-49` |
| Invalid override falls back      | `Number.isInteger(fromEnv) && fromEnv > 0` guard                 | `local-gemma-runtime.ts:45-46` |

Both resident (`spawnProcess`) and cold-spawn (`local-gemma-adapter.ts:388`) use `resolveCtxSize`. ✅

### Requirement: KV cache precision with VRAM fallback

| Scenario                     | Implementation                                                      | Evidence |
|------------------------------|---------------------------------------------------------------------|----------|
| FP16 by default              | `resolveKvType(undefined)` → `"f16"`; `--cache-type-k/v` flags omitted | `local-gemma-runtime.ts:51-52`, `buildSpawnArgs:73` |
| Fallback to q8_0 on VRAM failure | `isVramLoadFailure(stderrBuf)` → retry with `kvType="q8_0"`, cached for runtime lifetime | `local-gemma-runtime.ts:225-231` |
| Explicit precision override   | `kvPinned = env !== undefined` disables auto-fallback              | `local-gemma-runtime.ts:109`, `:225` |

✅

### Requirement: New conversation resets local model context

| Scenario                          | Implementation                                                      | Evidence |
|-----------------------------------|---------------------------------------------------------------------|----------|
| New chat at zero context          | `shouldReuseProcess` returns false when `currentSessionId !== sessionId` → evict + respawn | `local-gemma-runtime.ts:93`, `ensureProcess:205-230` |
| Same conversation reuses warm process | All 4 conditions must hold: resident ∧ system ∧ sessionId ∧ turns < MAX | `local-gemma-runtime.ts:89-95` |

`sessionId` flows: `AgentRunRequest.sessionId` → `tryRunResident` → `runtime.runTurn` → `ensureProcess` → stored as `currentSessionId`. ✅

### Requirement: Conversation history in prompt (MODIFIED)

| Scenario                          | Implementation                                                      | Evidence |
|-----------------------------------|---------------------------------------------------------------------|----------|
| Multi-turn context                | History included in `buildCopywriterPrompt` via `input.history`    | `copywriter-skill.ts:247-252` |
| History exceeds token budget      | `trimHistoryToBudget(recent, historyBudget)` drops oldest, keeps newest | `copywriter-skill.ts:248` |
| Always retains current user message | `userText` pushed to `userSections` outside of budget calc (lines 237, 254) | `copywriter-skill.ts:237, 254` |
| Does not fail on long history     | Budget ≤ 0 → `trimHistoryToBudget` returns `[]`; never throws      | `copywriter-skill.ts:63` |

Budget calculation: `contextWindow - estimateTokens(system+fixedSections) - OUTPUT_RESERVE_TOKENS(512) - SAFETY_MARGIN_TOKENS(256)`. ✅

---

## Coherence

### Layer boundaries (from design.md)

| Layer              | Responsibility                  | Status |
|--------------------|---------------------------------|--------|
| `packages/review-core`   | Pure prompt shaping, token-budget trimming | ✅ No process/VRAM knowledge |
| `packages/agent-adapters` | Process lifecycle, ctx-size, KV precision | ✅ No guideline/prompt logic |
| `apps/daemon`      | Manifest config, adapter construction | ✅ Passes `contextSize` from manifest |

### Design decisions followed

| Decision                                             | Status |
|------------------------------------------------------|--------|
| FP16 first, q8_0 only as VRAM fallback              | ✅     |
| `chars/4` conservative estimate (over-count)         | ✅     |
| Silent trimming (no overflow marker)                 | ✅     |
| `HISTORY_LIMIT = 6` as secondary count cap           | ✅ `slice(-HISTORY_LIMIT)` applied before budget trim |
| Manifest `defaultContext` is single source of truth  | ✅     |
| Explicit `WRITER_LOCAL_KV_TYPE` disables fallback    | ✅     |

---

## Issues

### ⚠️ WARNING — Manual smoke not yet performed (task 5.4)

**What:** Task 5.4 requires a live Local Gemma inference run to confirm: (a) long chats don't error at the old 4096 token boundary, (b) a new chat has no prior context, (c) tok/s stays ~50 with FP16 KV at 16K.

**Why not blocking archive:** This is a runtime behavior that cannot be verified in CI. All code paths implementing these behaviors have automated unit test coverage. Recommend running the smoke test before merge.

**To verify:**
1. Launch the app with `llama-cli` and Gemma 4 E4B model loaded.
2. Send 15–20 messages or paste long blocks; confirm no error after ~4096 tokens.
3. Click New Chat; ask the model to repeat something from the prior chat — confirm it has no context.
4. With `WRITER_LOCAL_KV_TYPE` unset, note tok/s from daemon logs.

---

## PASS

No critical issues. All four feature requirements are fully implemented and unit-tested. One expected warning: manual smoke (task 5.4) requires live GPU and is not a code blocker for archive.
