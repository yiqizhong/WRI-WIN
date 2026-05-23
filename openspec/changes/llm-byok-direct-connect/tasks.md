<!-- Linear: epic WRI-59 -->

## 1. Contracts and storage (WRI-60)

- [x] 1.1 Add `llmByokConfigSchema`, `llmExecutionModeSchema` to contracts
- [x] 1.2 Persist BYOK settings in platform store

## 2. LLM proxy (WRI-61)

- [x] 2.1 `packages/llm-proxy`: OpenAI SSE client + URL validation
- [x] 2.2 `POST /llm/proxy/stream` route

## 3. BYOK adapter (WRI-62)

- [x] 3.1 `byok` adapter using proxy for `agents/runs`
- [x] 3.2 Execution mode dispatch in daemon

## 4. Desktop (WRI-63)

- [x] 4.1 API provider settings + test stream
- [x] 4.2 Execution mode toggle CLI vs Direct API

## 5. Polish (WRI-64, WRI-65)

- [x] 5.1 Auto-refresh agents on desktop connect
- [x] 5.2 Tests, README, verify.md
