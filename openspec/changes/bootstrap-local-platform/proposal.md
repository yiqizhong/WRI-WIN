## Why

The product needs a local-first platform foundation before UX copy review features can be built safely. Electron, the local daemon, agent adapters, MCP tools, and permission gates must be established early because Figma writeback and local file operations depend on these boundaries.

## What Changes

- Add an Electron desktop shell that owns the user-facing app surface and delegates privileged work to a local daemon.
- Add a local daemon that exposes a private API for health, project/session metadata, agent execution, MCP management, and tool execution.
- Add a typed desktop-to-daemon contract so the renderer never directly owns privileged local operations.
- Add an agent adapter runtime that can detect local agent CLIs and run one first adapter end to end.
- Add a tool and MCP runtime with explicit read/write risk metadata and permission gates.
- Add a Figma MCP smoke path for read access and a controlled permissioned write action.
- Add local project/session persistence sufficient for follow-on review workflows.

## Capabilities

### New Capabilities

- `desktop-shell`: Electron desktop app shell, navigation, settings entry points, daemon status display, and desktop file capabilities.
- `local-daemon`: Local private service for health checks, project/session persistence, privileged operations, and audit logging.
- `agent-adapter-runtime`: Runtime contract for detecting, launching, streaming, canceling, and reporting capabilities from local agent CLIs.
- `tool-mcp-runtime`: Tool registry, MCP server lifecycle, read/write risk metadata, permission gates, and Figma MCP smoke path.
- `review-session-storage`: Local storage model for projects, review sessions, run transcripts, approval decisions, and generated artifacts.

### Modified Capabilities

- None.

## Impact

- Affected code: new desktop app, daemon service, shared contracts, local storage, agent adapter, and MCP/tool runtime packages.
- Affected APIs: private desktop-to-daemon API, agent adapter interface, tool registry interface, permission request/decision flow, and health/status endpoints.
- Affected dependencies: Electron, local server/runtime libraries, schema validation, process management, local storage, MCP client integration, and Figma MCP configuration.
- Affected systems: local filesystem, local agent CLIs such as Claude Code/Codex/Cursor Agent, MCP servers, and Figma write-capable tooling.
