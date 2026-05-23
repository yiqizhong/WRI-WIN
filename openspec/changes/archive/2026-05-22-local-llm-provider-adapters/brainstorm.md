# Brainstorm: Local LLM provider adapters (Cursor, Codex, Claude, Devin)

## Background

Writer already has `packages/agent-adapters` with:
- **echo** adapter (working, for tests)
- **codex** and **cursor-agent** stubs (`available: false`)
- Daemon routes: `GET /agents`, `POST /agents/active`, `POST /agents/runs`, cancel
- Desktop **Agents and MCP** panel (list + select active adapter)

Product goal (user): **用户在桌面端可选择并连接本机已安装的 Cursor、Codex、Claude、Devin，用它们作为 LLM/Agent 后端跑 UX copy review。**

Architecture constraint (frozen): renderer never spawns CLIs; **daemon owns adapter detection, run, stream, cancel**.

## Q1 — 集成形态：怎么「连」本地 LLM？

| 选项 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| **A. 统一 CLI 子进程** | 每个厂商一个 adapter：`detect()` 查 PATH/版本，`run()` spawn CLI，解析 stdout 流 | 与 bootstrap 设计一致；可测；权限边界清晰 | 各 CLI 输出格式不同，需分别解析 |
| **B. SDK 优先** | Cursor 用 `@cursor/sdk` local；其余 CLI | Cursor 流式/取消更稳 | 依赖混用，维护两套 |
| **C. 云端 API** | 全部走各厂商 REST | 不依赖本机安装 | 违背「本地」目标；密钥与合规复杂 |

**倾向：A 为主，B 仅用于 Cursor（若 CLI 流式不足再切 SDK）。** Devin / Codex / Claude 均以官方本地 CLI 为 v1 路径。

## Q2 — 四个 provider 的本机入口（v1 假设）

| Provider | Adapter ID | 本机检测 | 执行（v1） |
|----------|------------|----------|------------|
| **Cursor** | `cursor-agent` | `cursor agent` 或 `which cursor` + 子命令探测 | `cursor agent` 非交互 + JSON/stream 解析（或 `@cursor/sdk` local `Agent.prompt` / stream） |
| **Codex** | `codex` | `codex --version` | `codex exec` / 文档对齐的非交互 prompt |
| **Claude** | `claude-code` | `claude --version` | `claude -p` / print mode，禁止默认写盘除非 permission profile 允许 |
| **Devin** | `devin` | `devin --version` | `devin -p "..."` 单轮；需 `devin /login` 或 API key 环境变量 |

**Open：** Devin 未登录时是否仅 `available: false` + setupMessage，不阻塞其他 adapter。

## Q3 — 桌面「连接」UX 含义

用户说的「链接」= **检测 + 选择 active adapter + 可选配置（API key / 路径）+ 试跑 smoke**，不是 OAuth 到 Writer 云。

- Settings / Agents 面板：每个 adapter 显示 **Available / Unavailable / Needs setup**
- **Test connection**：`POST /agents/smoke` 跑 5–10 token 的 echo prompt，展示首段输出或错误
- 持久化：`activeAdapterId` 已有；新增 `adapterSettings`（加密可选，v1 可明文 env 引用）

## Q4 — Review 任务如何调用 LLM？

v1 范围：**把现有 stub audit 之外的「真实 LLM 调用」接到 `POST /agents/runs`**，prompt 模板由 review-core 组装（session context + brand voice）。

- 不在此 change 做完整 multi-step agent tool loop（属后续）
- **成功标准**：用户选 Claude/Codex/Cursor/Devin 之一，对 pasted-text session 发起 run，收到流式 `text` events 并完成

## Agreed direction (pending user confirm on Q5)

1. Implement four real adapters in `packages/agent-adapters` replacing stubs (keep echo).
2. Shared `cli-adapter` helper: spawn, stderr/stdout tee, NDJSON line parser hook, cancel SIGTERM.
3. Daemon: optional `POST /agents/detect` refresh, `POST /agents/smoke`, document env vars in README.
4. Desktop: per-adapter status, Test button, clearer setup messages.

## Q5 — 已确认（用户: A）

**四家全做：** Cursor、Codex、Claude Code、Devin 均以本机 CLI 接入；Devin 在 UI/metadata 标注 **hybrid**（本机 CLI + 云端推理）。

**执行顺序：** 先在 Linear 建 epic + 子 issues，再按 issue 执行（见 `docs/linear-openspec-map.md` § local-llm-provider-adapters）。

## Trade-offs

- **不**在 renderer 内嵌各 CLI SDK → 安全与可测性更好，但首次集成要写好 stream 解析。
- **不**统一成一个「LLM router」抽象层 beyond existing `AgentAdapterImplementation` → YAGNI。
- 权限：review 场景默认 **read-only / no file write** CLI flags（各 CLI 文档对齐）。
