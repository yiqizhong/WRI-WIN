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

In **Sources**, paste a Figma frame URL (`figma.com/design/...?node-id=...`), connect Figma MCP under **Agents**, start a session, then **Run audit** on the Review screen to load real text from that frame.

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

## Guidelines (3-layer)

Writer stores UX writing guidelines on disk under `~/.writer/guidelines/`. The desktop **Guidelines** screen uploads and manages fixed company slots plus expandable product cards.

```text
~/.writer/guidelines/
├── company-base.md              # Brand voice + company-wide rules
├── software-writing.md          # Cross-product UX writing rules
├── company-glossary.csv|md      # Optional company-wide terms
└── products/
    └── <product-id>/
        ├── background.md        # Required — audience, environment, purpose + prose
        ├── glossary.csv|md      # Optional product terms
        └── writing-guide.md     # Optional product-specific rule overrides
```

Each **project** selects an **active product** (`activeProductId`) so audits merge company layers with that product’s background, glossary, and writing guide.

**Upload flow (desktop):**

1. Open **Guidelines** in the desktop app (daemon must be running).
2. Drop or browse files into **Company base**, **Software writing**, or **Company glossary** — replacing an existing file asks for confirmation.
3. Click **Add product**, enter a product id and background fields (or upload `background.md`).
4. Expand a product card to upload/replace/delete glossary or writing-guide slots, or drop files on the card (files are routed by name: `background.md`, `glossary.*`, other `.md` → writing guide).

**Download templates** (also served by the daemon):

| Template | URL path |
|----------|----------|
| Company base | `GET /guidelines/templates/company-base.md` |
| Software writing | `GET /guidelines/templates/software-writing.md` |
| Company glossary (CSV) | `GET /guidelines/templates/glossary.csv` |
| Product background | `GET /guidelines/templates/product-background.md` |
| Product writing guide | `GET /guidelines/templates/product-writing-guide.md` |

Legacy flat `company.md` / `products/<name>.md` layouts from early bootstrap are no longer scaffolded; use the structure above (see Linear epic [WRI-112](https://linear.app/uicb/issue/WRI-112)).

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
| Cursor Agent | `cursor-agent` | Cursor CLI | Uses `cursor agent -p -f` (trusts project dir) |
| Devin | `devin` | [Devin for Terminal](https://cli.devin.ai/docs) | Hybrid: local CLI, cloud inference; run `/login` first |

**Desktop:** Agents panel → **Refresh detection** → **Test connection** → **Use adapter**.

**API:**

- `GET /agents` — list adapters + active id
- `POST /agents/detect` — refresh detection
- `POST /agents/smoke` — `{ "adapterId": "devin" }` short probe
- `POST /agents/runs` — run review prompt

Connection diagnostics use stable codes so setup failures are actionable:

| Code | Meaning | Typical recovery |
|------|---------|------------------|
| `missing_command` | CLI is not on PATH | Install the CLI or fix PATH |
| `broken_executable` | Wrapper exists but underlying binary cannot spawn | Reinstall/repair the CLI package |
| `version_probe_failed` | Version probe returned non-zero | Run the CLI manually and fix install/auth |
| `needs_auth` | CLI needs login | Complete provider login |
| `timeout` | Probe or smoke hung | Check interactive prompts/auth and retry |
| `smoke_failed` | Short prompt failed | Inspect stdout/stderr snippet in UI |
| `ready` | Provider is usable | Select and run |

Example: if a CLI version probe fails with a broken wrapper or missing vendor binary, Writer marks the adapter as `broken_executable` and suggests reinstalling or repairing that CLI instead of showing a generic unavailable state.

Set `WRITER_AGENT_STUBS=1` to register echo only (tests/CI without CLIs).

## Figma MCP setup and smoke

Writer defaults to Figma's official remote MCP server (`https://mcp.figma.com/mcp`), the same endpoint Claude Code uses. No manual env setup is required for the common case.

**Desktop:** enable **Figma MCP**, click **Connect Figma**, sign in in the browser, then run **Test Figma read**.

Tokens are stored in `~/.writer/mcp-auth/figma.json` and refreshed automatically.

Advanced overrides:

```bash
export WRITER_FIGMA_MCP_URL=https://mcp.figma.com/mcp
export WRITER_FIGMA_MCP_READ_TOOL=figma_get_file
./scripts/smoke-figma-mcp.sh
```

The remote server uses Figma OAuth. Writer runs the OAuth callback on `http://127.0.0.1:19876/mcp/oauth/callback` (same pattern as Claude Code / Cursor). On this machine, Claude Code already has user-scope Figma MCP configured and connected:

```bash
claude mcp list
# figma: https://mcp.figma.com/mcp (HTTP) - Connected
```

The official Codex CLI setup is:

```bash
codex mcp add figma --url https://mcp.figma.com/mcp
```

That currently requires a repaired Codex CLI on this machine; the installed wrapper reports a vendor binary `ENOENT`.

For a local stdio MCP server, keep using:

```bash
export WRITER_FIGMA_MCP_COMMAND=your-figma-mcp-command
export WRITER_FIGMA_MCP_ARGS='["--stdio"]'
export WRITER_FIGMA_MCP_READ_TOOL=figma_get_file
export FIGMA_ACCESS_TOKEN=your-token # if your Figma MCP server expects it
./scripts/smoke-figma-mcp.sh
```

The daemon owns the configured MCP connection. Desktop only toggles the configured server and calls daemon smoke endpoints.

Relevant endpoints:

- `GET /mcp/servers` — status, diagnostics, capabilities, discovered tools
- `POST /mcp/servers/figma` — `{ "enabled": true }` starts and initializes the configured MCP server
- `GET /mcp/smoke/figma/read` — calls the configured/discovered read-capable MCP tool

Figma MCP diagnostics:

| Code | Meaning | Typical recovery |
|------|---------|------------------|
| `not_configured` | No MCP URL or command configured | Set `WRITER_FIGMA_MCP_URL` for remote HTTP, or `WRITER_FIGMA_MCP_COMMAND` for stdio |
| `needs_auth` | Remote server requires OAuth | Click **Connect Figma** in the desktop app |
| `startup_failed` | Server process/init failed | Check URL, command, args, token, and server logs |
| `tool_not_found` | Connected but no read tool selected/discovered | Set `WRITER_FIGMA_MCP_READ_TOOL` |
| `smoke_failed` | MCP tool call failed | Check Figma auth, file access, and tool args |
| `mcp_not_ready` | Figma MCP not connected for extraction | Open Agents → Connect Figma, then re-run audit |
| `unsupported_figma_source` | Scope not supported (file-wide, Make, etc.) | Paste a frame URL with `node-id` |
| `ready` | MCP server initialized | Run read smoke |

Or run the daemon Vitest checks:

```bash
npm --workspace @writer/daemon run test -- mcp-client.test.ts mcp.smoke.test.ts
```

## Known limitations (bootstrap slice)

- Agent adapters besides `echo` require locally installed CLIs
- Review findings/rewrites schemas exist; audit engine UI is not built yet
- PDF/spreadsheet export workflows are planned in later milestones

## OpenSpec

Active change: `openspec/changes/harden-local-cli-figma-mcp-connections/`

Linear project: [Figma UX Copy Review v1](https://linear.app/uicb/project/figma-ux-copy-review-v1-4a213fbaf788)
