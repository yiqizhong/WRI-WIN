## Why

Writer 已完成本地 daemon 与 agent adapter 骨架，但 Codex、Cursor、Claude、Devin 仍为不可用 stub，用户无法在桌面端选择真实 LLM 后端跑 copy review。产品下一里程碑要求：用户在本机安装并登录这些工具后，于 Writer 内检测、选择、试连并用其执行 review prompt。现在补齐适配层，才能让人机门禁后的审计/改写走真实模型，而不是 echo/stub。

## What Changes

**Agent detection and availability**
- From: stub adapters always report `available: false`.
- To: four adapters detect local CLI/SDK presence, version, and auth/setup state with actionable `setupMessage`.
- Reason: User must see which providers are connectable before running review.
- Impact: Non-breaking API shape; behavior change on `GET /agents`.

**Agent execution**
- From: only echo adapter produces streamed run events.
- To: Cursor, Codex, Claude Code, and Devin adapters spawn local interfaces and normalize stdout/SDK stream into `AgentRunEvent`.
- Reason: Fulfill "use local LLM" goal through existing `POST /agents/runs`.
- Impact: New subprocess/SDK dependencies at runtime; daemon remains sole launcher.

**Desktop connection UX**
- From: Agents panel lists adapters and sets active ID only.
- To: per-adapter status, setup hints, and "Test connection" smoke via daemon.
- Reason: "链接" implies verify-before-trust, not silent failure at audit time.
- Impact: Desktop-only UI; no renderer CLI access.

**Daemon API additions**
- From: no redetect/smoke endpoints.
- To: `POST /agents/detect` (refresh) and `POST /agents/smoke` (short prompt probe) optional in v1.
- Reason: Support Settings workflow without full review session.
- Impact: Non-breaking additive routes.

## Capabilities

### New Capabilities
- `agent-llm-providers`: Detection, configuration metadata, CLI/SDK invocation, and smoke-test behavior for Cursor, Codex, Claude Code, and Devin local interfaces.

### Modified Capabilities
- `agent-adapter-runtime`: Extend requirements for multi-provider availability, normalized streaming from external CLIs, cancel semantics, and desktop-visible setup states.

## Impact

- `packages/agent-adapters` — new adapter modules + shared CLI runner utilities
- `packages/contracts` — optional adapter metadata (runtime kind, auth state)
- `apps/daemon` — wire registry, smoke/detect routes, env documentation
- `apps/desktop` — Agents panel test/setup UX
- `docs/linear-openspec-map.md` — new WRI mapping when implementation starts
- Runtime: requires user-installed CLIs and credentials (not bundled)
