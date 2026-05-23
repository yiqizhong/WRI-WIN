# Writer

Local-first Figma UX copy review desktop app (Electron + daemon + agent/MCP runtime).

## Prerequisites

- Node.js 20+
- npm 10+

## Quick start

```bash
npm install
npm run dev:daemon
```

In another terminal:

```bash
npm run dev:desktop
```

## Development commands

| Command | Description |
|---------|-------------|
| `npm run dev:daemon` | Start local daemon on `http://127.0.0.1:47631` |
| `npm run dev:desktop` | Start Electron desktop shell |
| `npm run typecheck` | Typecheck all workspaces |
| `npm run test` | Run unit and integration tests |

## Architecture

- `apps/desktop` — Electron UI (no privileged local operations in renderer)
- `apps/daemon` — Private local API, agents, tools, MCP, permissions, storage
- `packages/contracts` — Shared Zod schemas
- `packages/review-core` — Figma URL parsing, context assembly, approval state machine, stub audit
- `packages/spreadsheet` — CSV/XLSX parsing and column role detection
- `packages/agent-adapters` — Local CLI agent adapters
- `packages/tool-runtime` — Tool registry and risk metadata
- `packages/storage` — `~/.writer/platform-store.json` persistence

See [docs/architecture/local-platform-architecture.md](docs/architecture/local-platform-architecture.md).

## Daemon API highlights

- `GET /health` — status and capabilities
- `GET /agents` — adapter discovery
- `POST /agents/runs` — run echo/dev adapter
- `GET /tools` — tool registry
- `POST /figma/parse-url` — parse Figma design URLs into review scope
- `POST /figma/extract` — stub text-node extraction for bootstrap
- `POST /sessions/pasted-text` — Light Edit pasted-text session
- `POST /review/audit/run` — Generate stub findings and queue items
- `GET /review/queue` — Review queue for desktop UI
- `POST /review/changes/bulk` — Bulk approve/reject/skip
- `POST /spreadsheet/parse` — Parse CSV/XLSX from local path
- `GET /review/export/markdown` / `GET /review/export/json` — Session exports
- `GET /mcp/smoke/figma/read` — Figma MCP read smoke

## Local LLM providers

Writer can route review prompts through locally installed agent CLIs (daemon-spawned only):

| Provider | Adapter ID | Install | Notes |
|----------|------------|---------|-------|
| Claude Code | `claude-code` | [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | Uses `claude -p` with write tools disallowed for review |
| Codex | `codex` | `npm i -g @openai/codex` | Uses `codex exec`; repair vendor binary if `ENOENT` |
| Cursor Agent | `cursor-agent` | Cursor CLI | Uses `cursor agent -p -f` (trusts project dir) |
| Devin | `devin` | [Devin for Terminal](https://cli.devin.ai/docs) | Hybrid: local CLI, cloud inference; run `/login` first |

**Desktop:** Agents panel → **Refresh detection** → **Test connection** → **Use adapter**.

**API:**

- `GET /agents` — list adapters + active id
- `POST /agents/detect` — refresh detection
- `POST /agents/smoke` — `{ "adapterId": "devin" }` short probe
- `POST /agents/runs` — run review prompt

Set `WRITER_AGENT_STUBS=1` to register echo only (tests/CI without CLIs).

## Figma MCP manual smoke

```bash
export FIGMA_ACCESS_TOKEN=your-token
./scripts/smoke-figma-mcp.sh
```

Or run the Vitest manual gate:

```bash
FIGMA_ACCESS_TOKEN=your-token npm --workspace @writer/daemon run test
```

## Known limitations (bootstrap slice)

- Figma extraction and writeback use stub/bootstrap paths until full MCP integration
- Agent adapters besides `echo` require locally installed CLIs
- Review findings/rewrites schemas exist; audit engine UI is not built yet
- PDF/spreadsheet export workflows are planned in later milestones

## OpenSpec

Active change: `openspec/changes/bootstrap-local-platform/`

Linear project: [Figma UX Copy Review v1](https://linear.app/uicb/project/figma-ux-copy-review-v1-4a213fbaf788)
