<!-- Linear: epic WRI-48 · mapping in docs/linear-openspec-map.md -->

## 1. Shared adapter infrastructure (WRI-49)

- [x] 1.1 Add `cli-runner` utilities (spawn, line stream, timeout, SIGTERM cancel, stderr capture)
- [x] 1.2 Extend `@writer/contracts` adapter schema with optional `runtimeKind`, `authState`, `executablePath`
- [x] 1.3 Register four real adapters in `createDefaultAgentRegistry()`; keep echo for tests behind `WRITER_AGENT_STUBS` or deprioritize when CLI available

## 2. Provider adapters (detect + run)

- [x] 2.1 Implement `claude-code` adapter — **WRI-51**
- [x] 2.2 Implement `codex` adapter — **WRI-50**
- [x] 2.3 Implement `cursor-agent` adapter — **WRI-52**
- [x] 2.4 Implement `devin` adapter — **WRI-53**
- [x] 2.5 Adapter unit tests — **WRI-54**

## 3. Daemon API (WRI-55, WRI-56)

- [x] 3.1 `POST /agents/detect` refresh all adapters
- [x] 3.2 `POST /agents/smoke` with `{ adapterId }` bounded probe
- [x] 3.3 Integration test: smoke + run against echo or mocked CLI
- [x] 3.4 Document env vars and install prerequisites in root `README.md`

## 4. Desktop connection UX (WRI-57)

- [x] 4.1 Agents panel: runtime kind badge, setup message, Refresh detection
- [x] 4.2 Test connection button → `POST /agents/smoke`
- [x] 4.3 Surface errors in workflow banner; disable run when active adapter unavailable

## 5. Verification (WRI-58)

- [x] 5.1 Manual matrix doc in change `verify.md` (install CLI → detect → smoke → run)
- [x] 5.2 `npm run typecheck` and `npm run test` green
