# Tasks — harden-local-trust-boundaries

> Each top-level section maps to one Linear child issue (see `docs/linear-openspec-map.md`).
> Severity from the verified audit (`docs/code-quality-audit-2026-06-09.md`).
> Every task closes with: `npm run typecheck`, `npm run test`, `npx openspec validate harden-local-trust-boundaries --type change --strict`.

## 1. V1 — Daemon auth token + Host/Origin enforcement (HIGH · local-daemon)

- [ ] 1.1 Daemon generates a per-launch token; write it to a `~/.writer`-scoped token file (0600) so any client (incl. a reused daemon) can authenticate.
- [ ] 1.2 `router.ts`: reject every non-`/health`, non-`OPTIONS` request whose `Authorization: Bearer <token>` is missing/wrong (401).
- [ ] 1.3 `router.ts`: add a `Host` allowlist (`127.0.0.1:<port>` / `localhost:<port>`) → 403 otherwise; actively reject disallowed `Origin` (not just omit the CORS header).
- [ ] 1.4 Electron `main.cjs`/`preload.cjs`: read the token file, expose the token to the renderer; `ensure-daemon.cjs` keeps `/health` unauthenticated so the startup probe + reuse path are unaffected.
- [ ] 1.5 `daemon-client.ts`: attach the `Authorization` header centrally; handle the `<img src>` screenshot + plain-URL export/template cases (exempt screenshot route after V4, or use `?token=`).
- [ ] 1.6 Tests: 401 without token, 403 on bad Host/Origin, `/health` open, screenshots still load, app launches against a pre-existing daemon.

## 2. V2 — Adapter-run gate + echo cmd.exe escaping (HIGH · agent-adapter-runtime)

- [ ] 2.1 `agents.ts` `resolveAdapterForRun`: reject any `adapterId` that is not `isKnownAdapterId` (dev/echo adapters not runnable from request input).
- [ ] 2.2 `echo-adapter.ts` `buildEchoSpawn`: escape `cmd.exe` metacharacters (reuse `cli-runner.escapeCmdMetacharacters`) or emit echo from Node without `cmd /c`.
- [ ] 2.3 Tests: `POST /agents/runs` with `adapterId:"echo"` is refused; a prompt containing `" & calc` cannot execute on the Windows spawn path.

## 3. V3 — Confine paste-text `filePath` (HIGH · local-daemon)

- [ ] 3.1 `paste-text.ts` `attachPasteTextFile`: resolve `filePath` and verify it stays under an allowed root (`assertInsideDir`), or accept only an opaque id mapped to a vetted path; reject absolute paths and `..`.
- [ ] 3.2 Apply the same confinement to the spreadsheet branch (`parseSpreadsheetFile`).
- [ ] 3.3 Tests: traversal/absolute paths rejected; legitimate picked attachments still work.

## 4. V4 — Screenshot path validation (MEDIUM · local-daemon)

- [ ] 4.1 `figma-screenshots.ts` `resolveScreenshotPath` + `routes/review.ts`: validate `sessionId` against a known session (UUID/lookup) before building the path.
- [ ] 4.2 `assertInsideDir` the resolved path under `<dataDir>/sessions` before reading.
- [ ] 4.3 Tests: `%2f` traversal rejected; real screenshots still served.

## 5. V5 — `openExternal` scheme allowlist (MEDIUM · desktop-shell)

- [ ] 5.1 `main.cjs`: validate URLs in `writer:open-external` — allow only `https:`/`http:`/`mailto:`, reject `file:`/UNC/`javascript:`/unknown schemes.
- [ ] 5.2 Apply the same guard in `setWindowOpenHandler`.
- [ ] 5.3 Tests: `file://`/custom-scheme rejected; normal `https` OAuth URL still opens.

## 6. V6 — Confine renderer-supplied write paths (LOW/backlog · desktop-shell)

- [ ] 6.1 `main.cjs`: stop trusting renderer-passed absolute paths in `writer:save-text-file` and `writer:export-pdf-from-html` — combine pick+write into one handler, or track dialog-approved paths and reject others.
- [ ] 6.2 Tests: write outside an approved path rejected; save-dialog flow still works.
