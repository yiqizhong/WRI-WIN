## 1. Repo and Contracts

- [x] 1.1 Create `apps/desktop`, `apps/daemon`, `packages/contracts`, `packages/agent-adapters`, `packages/tool-runtime`, and `packages/storage`.
- [x] 1.2 Add root development scripts to run desktop, daemon, typecheck, lint, and tests.
- [x] 1.3 Define shared contract schemas for daemon health, structured errors, projects, sessions, agent capabilities, run events, tools, MCP servers, and permission requests.
- [x] 1.4 Add contract tests that validate success and failure payloads.

## 2. Local Daemon

- [x] 2.1 Implement daemon startup with configuration loading and local logging.
- [x] 2.2 Implement health/status endpoint with version and capability summary.
- [x] 2.3 Implement structured error handling for invalid requests, missing subprocesses, unavailable services, and permission denial.
- [x] 2.4 Add daemon API routes for project metadata, session metadata, agent listing, tool listing, MCP status, and permission decisions.

## 3. Desktop Shell

- [x] 3.1 Implement Electron desktop app shell with navigation, workspace area, settings entry, and daemon status display.
- [x] 3.2 Implement the desktop-to-daemon client using shared contracts.
- [x] 3.3 Add unavailable/degraded daemon states with user-readable recovery messages.
- [x] 3.4 Route local folder selection and file operations through the daemon boundary.

## 4. Storage

- [x] 4.1 Implement local project metadata persistence.
- [x] 4.2 Implement review session metadata persistence with source type, scope, timestamps, status, and related run IDs.
- [x] 4.3 Implement audit log persistence for permission decisions, agent run lifecycle events, and write-capable tool attempts.
- [x] 4.4 Add storage versioning and tests for restart/reopen behavior.

## 5. Agent Adapter Runtime

- [ ] 5.1 Define the agent adapter interface for detect, capability report, run, stream, cancel, and error normalization.
- [ ] 5.2 Implement local agent discovery and daemon endpoint for listing adapters.
- [ ] 5.3 Implement one working local CLI adapter that can run a simple UX copy review prompt.
- [ ] 5.4 Normalize agent run events and persist run lifecycle metadata.
- [ ] 5.5 Implement cancellation for in-flight agent runs.

## 6. Tool and MCP Runtime

- [ ] 6.1 Implement tool registry with source, capability, and risk metadata.
- [ ] 6.2 Implement permission request and decision flow for write/destructive tools.
- [ ] 6.3 Implement MCP server configuration, enable/disable, connection status, and capability listing.
- [ ] 6.4 Add Figma MCP connection smoke check for read metadata.
- [ ] 6.5 Add controlled Figma MCP write smoke action that requires permission and records the result.

## 7. Verification

- [ ] 7.1 Add unit tests for contracts, daemon errors, storage, adapter event normalization, tool risk classification, and permission checks.
- [ ] 7.2 Add an integration smoke test that starts daemon, connects desktop client, lists capabilities, and runs a simple agent prompt.
- [ ] 7.3 Add a Figma MCP smoke test path that can be run manually with credentials/configuration.
- [ ] 7.4 Update local documentation with setup steps, architecture boundaries, and known limitations.
