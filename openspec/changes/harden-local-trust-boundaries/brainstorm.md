# Brainstorm — harden-local-trust-boundaries

**Origin:** Full-codebase security/robustness/efficiency audit on `main` (2026-06-09), logged at
`docs/code-quality-audit-2026-06-09.md`. Findings verified + adversarially cross-checked.

## Scope decision

- **Two epics** chosen over one: security findings have different urgency/reviewers than the
  robustness/efficiency work, and each OpenSpec change stays focused. This change is the
  **security** epic. The quality epic is `improve-robustness-and-efficiency`.
- **LOW items kept as backlog issues** (not dropped) so nothing is lost; they are clearly
  deprioritized.
- **Spec deltas authored per finding at implementation time**, not all up front — this change
  is the tracking/epic structure plus per-finding tasks, not premature design.

## Threat model (from the audit)

The daemon binds to `127.0.0.1` but applies **no auth, no Host allowlist, and no Origin
rejection** (V1). The realistic attackers are (a) another local process and (b) a malicious
website the user visits — reachable via CSRF (state-changing) and DNS-rebinding (full read).
V1 is the root-cause amplifier that makes V2/V3/V4 remotely reachable. The Electron shell is
otherwise hardened (contextIsolation on, no nodeIntegration, fixed preload, deny child windows).

## Findings in this epic

| Task | Finding | Severity | Capability |
|------|---------|----------|------------|
| 1 | V1 — daemon auth token + Host/Origin enforcement | HIGH | local-daemon |
| 2 | V2 — gate `resolveAdapterForRun` on `isKnownAdapterId` + escape echo cmd.exe args | HIGH | agent-adapter-runtime |
| 3 | V3 — confine paste-text `filePath` to an allowed root | HIGH | local-daemon |
| 4 | V4 — validate `sessionId` + `assertInsideDir` for screenshots | MEDIUM | local-daemon |
| 5 | V5 — allowlist URL schemes in `openExternal` + `setWindowOpenHandler` | MEDIUM | desktop-shell |
| 6 | V6 — stop trusting renderer paths in `save-text-file`/`exportPdf` (backlog) | LOW | desktop-shell |

V1 is the priority (amplifier). V2–V6 are independent fixes with no hard `blockedBy`.
