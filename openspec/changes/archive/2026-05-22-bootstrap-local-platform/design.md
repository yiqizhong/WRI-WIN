## Context

The repository currently contains product discovery notes and an empty OpenSpec structure. The first implementation slice must create a local-first platform that can support the full UX copy review product without letting the renderer, an agent, or an MCP server mutate local files or Figma directly.

The target architecture is:

```text
Electron desktop shell
-> local daemon private API
-> shared contracts
-> agent adapter runtime
-> tool and MCP runtime
-> local storage, Figma MCP, network tools, report/export capabilities
```

Stakeholders are designers, PMs, and content designers using a non-technical desktop UI. Platform stakeholders are future agent adapters for Claude Code, Codex, Cursor Agent, and other local CLIs.

## Goals / Non-Goals

**Goals:**

- Establish the repository structure for a multi-package desktop product.
- Create a desktop shell that can show daemon health, settings, and a workspace.
- Create a local daemon as the only owner of privileged work.
- Define typed contracts shared by the desktop app and daemon.
- Define an agent adapter interface and implement one end-to-end local CLI path.
- Define a tool/MCP registry with risk metadata and permission checks.
- Prove Figma MCP can be connected through read and controlled write smoke paths.
- Persist enough project/session state to support follow-on review workflows.

**Non-Goals:**

- Full UX copy audit logic.
- Full Figma text extraction, review queue, and writeback workflow.
- Spreadsheet import/export implementation.
- Multi-user sync or cloud collaboration.
- Plugin marketplace or arbitrary third-party tool installation.

## Decisions

### Use a package-based repo layout

Decision: use separate app and package boundaries:

```text
apps/desktop
apps/daemon
packages/contracts
packages/agent-adapters
packages/tool-runtime
packages/storage
```

Rationale: the product has a hard privilege boundary. Keeping renderer UI, daemon APIs, contracts, adapters, tools, and persistence in separate packages makes it harder to accidentally mix responsibilities.

Alternative considered: a single Electron app with main-process services. That is faster initially but becomes messy once agent processes, MCP lifecycle, permission gates, and writeback audit logs are added.

### Make the daemon the platform core

Decision: the desktop app talks to the daemon through a private local API. The daemon owns local filesystem writes, project/session storage, agent launches, MCP connections, tool execution, permission decisions, audit logs, and report/export generation.

Rationale: this centralizes security and auditability. It also lets the desktop shell stay a focused product UI instead of becoming a mixed UI/runtime process.

Alternative considered: let the Electron main process own all privileged work. This would work for a smaller app but would make future adapters and MCP runtime harder to test independently.

### Use shared schemas for contracts

Decision: define request/response, event, tool, permission, and storage schemas in `packages/contracts`.

Rationale: the desktop and daemon must agree on state names, capability metadata, and permission semantics. Runtime validation is needed because agent and MCP outputs are external inputs.

Alternative considered: TypeScript-only interfaces. Static typing alone is not enough for local process boundaries and external tool responses.

### Model agent CLIs behind adapters

Decision: define an adapter contract with detection, capability reporting, run, stream, cancel, and error normalization methods. The first adapter only needs to prove one local CLI works end to end.

Rationale: Claude Code, Codex, Cursor Agent, and future tools will differ in commands, streaming output, permissions, and supported features. A narrow adapter boundary keeps the daemon stable.

Alternative considered: hardcode one CLI path directly in the daemon. That would delay the adapter abstraction but create churn as soon as the second CLI is added.

### Treat tools as capability-checked operations

Decision: every tool must declare source, capability, and risk level: read-only, network, write, or destructive. Write and destructive tools require daemon-enforced permission checks before execution.

Rationale: Figma writeback is product-critical and potentially destructive. The daemon must reject unsafe calls even if an agent asks for them.

Alternative considered: trust the selected agent's own permission model. That is insufficient because the product has its own Human Gate and audit requirements.

### Start Figma with a smoke path

Decision: the platform slice only proves Figma MCP connectivity with basic read metadata and one controlled write action after permission.

Rationale: this validates the hardest integration boundary before building the full review workflow, without prematurely designing all Figma extraction and writeback behavior.

Alternative considered: implement full Figma extraction in the first slice. That would mix platform and product workflow risk.

## Risks / Trade-offs

- Local CLI variance -> keep adapter output normalized and surface setup errors in settings.
- Figma MCP auth and permissions fail unpredictably -> separate connection, auth, file access, and write permission errors.
- Agent or MCP output is malformed -> validate all external outputs against shared schemas before using them.
- Daemon API expands too quickly -> start with health, project/session metadata, agent run, tool list, MCP status, and permission endpoints only.
- Write paths become unsafe -> make the daemon enforce permission gates and approved change IDs even if UI checks already passed.
- Local storage schema changes during early development -> version storage records and keep migrations simple from the first commit.

## Migration Plan

1. Add the package structure and development scripts.
2. Add shared schemas and daemon health endpoint.
3. Add desktop shell and daemon status display.
4. Add project/session persistence.
5. Add agent adapter contract and one working adapter.
6. Add tool registry, permission model, and MCP lifecycle.
7. Add Figma MCP read/write smoke path.
8. Use this platform as the base for the next OpenSpec change: Figma text extraction and structured copy audit.

Rollback is simple during this phase: no production data migration exists yet. Remove the new packages or disable daemon startup if the slice is not ready.

## Open Questions

- Which local CLI adapter should be implemented first in the repo: Codex, Claude Code, or Cursor Agent?
- Should the daemon use HTTP, IPC, or a local socket for the first private API?
- Which local storage engine should be the default: file-based JSON/SQLite, or a lightweight embedded database?
- Should Figma MCP be configured through a bundled default profile, user-provided config, or both?
