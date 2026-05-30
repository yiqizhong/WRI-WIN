## 1. Manifest (daemon config)

- [ ] 1.1 Raise `defaultContext` from 8192 to 16384 in `apps/daemon/src/local-model-manifest.ts`; keep `modelMaxContext` unchanged.
- [ ] 1.2 Update `apps/daemon/src/local-model-manifest.test.ts` to assert the new `defaultContext` and that it does not exceed `modelMaxContext`.

## 2. Token-aware history trimming (review-core)

- [ ] 2.1 Add a pure `trimHistoryToBudget(history, budget)` helper in `packages/review-core/src/copywriter-skill.ts` using a conservative `ceil(chars/4)` token estimate; always retain the current text; keep `HISTORY_LIMIT` as a secondary cap.
- [ ] 2.2 Compute the budget from the resolved context size minus reserved output (512), estimated fixed/system context, and a safety margin; thread the context size in via `CopywriterSkillInput` (or a constant kept in sync with the manifest).
- [ ] 2.3 Replace the count-only `slice(-HISTORY_LIMIT)` in `buildCopywriterPrompt` with the budget trim (silent, no overflow marker).
- [ ] 2.4 Add `copywriter-skill.test.ts` cases: keeps newest, drops oldest, never exceeds budget, always keeps current text, long single message is bounded.

## 3. Context size + KV precision (agent-adapters runtime)

- [ ] 3.1 Resolve ctx-size in `local-gemma-runtime.ts`: `WRITER_LOCAL_CTX_SIZE` env → manifest `defaultContext` → 16384; replace the hardcoded `--ctx-size 4096`.
- [ ] 3.2 Apply the same resolved ctx-size to the cold-spawn fallback in `local-gemma-adapter.ts`.
- [ ] 3.3 Add KV precision resolution (`WRITER_LOCAL_KV_TYPE` → default `f16`) and pass `--cache-type-k/v` only when not `f16`.
- [ ] 3.4 Add FP16→q8_0 fallback: on load failure with a VRAM/allocation signature, re-spawn once with `q8_0` and cache the precision for the runtime's lifetime; an explicit `WRITER_LOCAL_KV_TYPE` disables auto-fallback.

## 4. New-chat zero-context reset (agent-adapters runtime)

- [ ] 4.1 Add `sessionId` to `LocalGemmaRuntime.runTurn(system, user, sessionId)` and track `currentSessionId`.
- [ ] 4.2 In `ensureProcess`, reuse the resident process only when system, sessionId, and turn budget all match; otherwise evict and respawn (true zero context).
- [ ] 4.3 Thread the conversation's `sessionId` from `tryRunResident` (`AgentRunRequest.sessionId`) into `runTurn`.

## 5. Verification

- [ ] 5.1 Add `local-gemma-runtime.test.ts` cases: spawn args carry the resolved ctx-size; env override respected; KV flags applied per precision; FP16→q8 fallback on simulated load failure; session change forces restart.
- [ ] 5.2 Add an adapter test that the cold-spawn fallback args carry the resolved ctx-size and KV flags.
- [ ] 5.3 Run `npm run typecheck`, `npm run test`, and `openspec validate expand-local-context-window --type change --strict`.
- [ ] 5.4 Manual: a long chat no longer errors at the old 4096 boundary; a new chat shows no prior-chat context; tok/s stays ~50 with FP16 KV at 16K (note if q8 fallback engages).
