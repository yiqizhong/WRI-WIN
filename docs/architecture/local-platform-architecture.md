# Local Platform Architecture

Date: 2026-05-22
Status: Architecture freeze for first implementation slice

## Purpose

This document freezes the first implementation architecture for the Figma UX copy review app. The goal is to build the local platform before implementing the full Figma audit and writeback workflow.

Primary product doc:

- `docs/superpowers/specs/2026-05-22-figma-ux-copy-review-design.md`

OpenSpec implementation change:

- `openspec/changes/bootstrap-local-platform/`

Linear project:

- `Figma UX Copy Review v1`

## Architecture

```text
Electron Desktop Shell
-> Local Daemon
-> Shared Contracts
-> Agent Adapter Runtime
-> Tool and MCP Runtime
-> Local Storage / Figma MCP / File Export / Network Tools
```

The desktop app owns the non-technical product UI. The daemon owns privileged local work and is the platform safety boundary.

## Repo Structure

The first slice should create this structure:

```text
apps/
  desktop/
  daemon/
packages/
  contracts/
  agent-adapters/
  tool-runtime/
  storage/
```

Responsibilities:

- `apps/desktop`: Electron shell, renderer UI, settings, review workspace, daemon status, desktop file dialogs.
- `apps/daemon`: private local API, local process runtime, MCP lifecycle, agent execution, permissions, audit logs, export orchestration.
- `packages/contracts`: shared schemas for requests, responses, run events, tools, permissions, sessions, errors, and capabilities.
- `packages/agent-adapters`: adapter interface and local CLI adapters for Codex, Claude Code, Cursor Agent, and future agents.
- `packages/tool-runtime`: tool registry, risk classification, MCP tool wrapping, permission checks.
- `packages/storage`: local project/session persistence, audit log, migration/version helpers.

## Runtime Boundaries

The renderer must not directly:

- mutate Figma;
- execute agent CLIs;
- start or manage MCP processes;
- write local artifacts;
- make final permission decisions for destructive tools.

The daemon must:

- validate every request through shared schemas;
- return structured, user-readable errors;
- own local file and export operations;
- launch and cancel agent runs;
- manage MCP server lifecycle;
- classify tools as read-only, network, write, or destructive;
- enforce permission gates before write/destructive tools;
- reject Figma writeback without approved change IDs in later slices;
- persist audit logs for permission and writeback decisions.

## First Implementation Slice

OpenSpec change: `bootstrap-local-platform`

Scope:

1. Create package structure and development scripts.
2. Add shared contracts.
3. Add daemon health/status endpoint.
4. Add desktop shell and daemon status display.
5. Add local project/session persistence.
6. Add agent adapter contract and one local CLI adapter.
7. Add tool registry and permission model.
8. Add MCP server lifecycle.
9. Add Figma MCP read/write smoke path.

Out of scope for this slice:

- full Figma text extraction;
- full UX copy audit logic;
- review queue;
- approved Figma writeback;
- spreadsheet import/export;
- report/PDF export.

## Linear Execution Order

Start with:

- `WRI-41`: Architecture Freeze
- `WRI-9`: Scaffold Electron desktop shell and renderer
- `WRI-10`: Add local daemon process and health API
- `WRI-11`: Implement desktop-to-daemon client boundary
- `WRI-13`: Define agent adapter contract and capability model
- `WRI-17`: Implement tool registry with read/write metadata
- `WRI-18`: Add daemon-enforced permission gate for write tools
- `WRI-20`: Connect Figma MCP read and write smoke path

Then proceed to Figma audit MVP:

- `WRI-21`: Parse Figma URLs and choose review scope
- `WRI-22`: Extract Figma text nodes with stable IDs
- `WRI-25`: Define UX copy finding and rewrite candidate schemas
- `WRI-26`: Build context assembler for UX copy audit runs

## Key Risks

- Figma writeback safety: daemon enforcement and approved change IDs are mandatory.
- Local CLI variance: keep all CLI behavior behind adapters and normalized events.
- MCP auth and file access errors: separate connection, authentication, file access, and write permission failures.
- Spreadsheet fidelity: preserve row identity and ordering once Light Edit starts.
- Scope creep: keep the first slice to platform smoke paths before building the full review workflow.
