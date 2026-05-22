# Figma UX Copy Review App Design Draft

Date: 2026-05-22
Status: Draft, still collecting product input

## Idea

Build an Electron desktop review app with a local daemon and agent runtime that uses an LLM to audit, review, rewrite, and optionally apply UX/UI copy changes from and back into Figma.

The product should help designers and PM/content designers improve interface copy directly from Figma context, while preserving a clear review and approval path before any destructive changes are made.

## Primary Users

- Designers reviewing Figma screens before handoff.
- PMs and content designers auditing product copy across screens and flows.

## Use Cases

### Core Use Cases

1. Figma flow audit

   A designer or content designer selects a Figma flow, runs a UX copy audit, reviews findings, approves rewrites, and writes approved changes back to Figma.

2. Figma whole-file consistency check

   A PM or content designer scans a file for inconsistent terminology, button labels, empty states, error messages, and tone mismatches.

3. Figma selected-frame polish

   A designer reviews one screen or frame before handoff and applies small copy fixes quickly.

4. Pasted-text rewrite

   A user pastes UI copy into the chat window and asks for clearer, shorter, more brand-aligned variants.

5. Spreadsheet copy audit

   A user uploads Excel or CSV strings, reviews suggested edits row by row, and exports an updated table.

### Likely Later Use Cases

- Localization QA: check translated UI strings for tone, length, truncation risk, and glossary consistency.
- Design system copy governance: audit component-level default labels, helper text, empty states, and error text.
- Release copy review: audit all user-facing copy before a launch or feature freeze.
- Support and onboarding copy alignment: compare product UI copy against help docs, onboarding emails, or support macros.
- Compliance-sensitive copy review: flag risky financial, medical, legal, or privacy language when relevant.
- A/B copy variants: generate approved alternatives for CTA labels, onboarding steps, or empty states.
- Copy regression check: compare before/after Figma or string-table snapshots and flag unwanted copy drift.

## Core Workflow

The product has two primary workflows:

- Full Figma workflow: inspect UX/UI copy inside Figma, review it with design context, approve changes, and write approved changes back to Figma.
- Light edit workflow: review or rewrite copy without requiring Figma, using pasted text, uploaded files, or lightweight structured inputs.

### Full Figma Workflow

1. User opens the desktop app.
2. User pastes a Figma file, frame, or flow URL.
3. User chooses the review scope.
4. User provides review context such as brand voice, product notes, audience, and terminology.
5. The app extracts UX/UI text and surrounding design context from Figma.
6. The LLM audits the copy.
7. The app presents findings with severity, rationale, and rewrite options.
8. User approves, edits, rejects, or applies individual rewrites.
9. Approved feedback can be pushed back into Figma as comments or text changes.
10. The app exports a side report for the review trail.

### Light Edit Workflow

The light edit workflow handles smaller copy tasks where the user may not have a Figma source.

Input options:

- Paste text into the chat window.
- Upload an Excel or CSV file containing UI copy, labels, messages, or strings.
- Upload a document or plain text file later if needed.

Expected outputs:

- Rewrite suggestions.
- Before/after table.
- Tone and clarity notes.
- Terminology consistency checks.
- Exportable results, such as CSV, XLSX, Markdown, or PDF depending on input type.

The light edit workflow should reuse the same review criteria and human approval model, but it does not need Figma node IDs or Figma writeback. If the input is tabular, the app should preserve row identity so approved edits can be exported back in a usable table.

### Spreadsheet Light Edit Requirements

Excel and CSV support is part of the first light edit version.

The app should:

- Detect likely source-copy columns, such as original text, key, screen, component, locale, notes, or context.
- Let the user confirm or remap columns before running the review.
- Produce suggested rewrite columns.
- Produce status columns such as proposed, approved, edited, rejected, applied, or skipped.
- Produce rationale or notes columns explaining the issue and rewrite.
- Preserve row identity and original ordering.
- Support row-by-row approval and bulk approval for filtered rows.
- Export an updated XLSX or CSV that includes original text, approved text, status, rationale, and notes.

The tabular approval model should match the Figma human gate, except the final output is a local exported table instead of Figma writeback.

## Supported Review Modes

The v1 app should support the full loop:

- Audit only: identify UX copy issues and leave suggestions.
- Rewrite candidates: generate improved alternatives, requiring human approval.
- Apply to Figma: replace approved text in Figma after explicit confirmation.

Default behavior should still be conservative: audit and suggest first. Direct rewrite is part of v1, but it must only happen after explicit approval.

## Figma Scope

The v1 app should support:

- Selected frame or page: safest default for focused review.
- Whole file audit: useful for consistency checks, with clear progress and filtering.
- Specific user flow: user selects multiple frames and defines the journey order.

## Review Criteria

The LLM should judge copy using:

- General UX writing heuristics: clarity, brevity, actionability, accessibility.
- Brand voice guide: tone, terminology, banned words, preferred words.
- Product context: target user, feature intent, business rules.
- Design context: nearby UI elements, visual hierarchy, flow position, screenshots or frame structure.

## Output

The system should produce both:

- Figma output: actionable comments, annotations, and optionally approved text replacements.
- Side report: findings, severities, rationale, rewrite options, decisions, and final applied changes.

## Product Direction

Chosen direction: Electron desktop app plus local daemon plus agent adapters.

The desktop app is the primary user interface for designers and PM/content designers. The local daemon is the privileged runtime layer that handles Figma import, MCP connections, LLM/agent execution, report generation, local files, exports, and approved Figma writeback.

This direction is preferred over a Figma plugin-first approach because it gives more room for review queues, reports, team settings, structured approval workflows, local file access, desktop exports, and flexible agent/runtime integration.

## Platform Architecture

The product should use an Open Design-style local-first architecture:

```text
Electron Desktop Shell
-> Local Daemon
-> Agent Adapter Layer
-> Local Agent CLI or API Provider
-> Tool Runtime
-> Figma MCP / Web / File / Export Capabilities
```

## V1 Scope Commitment

The full read-review-approve-write loop is in scope for v1.

V1 includes:

- Electron desktop shell.
- Local daemon.
- Agent adapter layer.
- At least one fully working local agent adapter.
- Figma MCP read support.
- Figma MCP write support.
- Internet-enabled tools where the user allows external context.
- MCP management for Figma and later integrations.
- Selected frame review.
- Whole file review.
- Ordered user-flow review.
- Audit findings.
- Rewrite candidates.
- Human approval queue.
- Figma comments or annotations.
- Approved Figma text replacement.
- Side report generation.
- PDF export.
- Local folder and file operations.
- Audit log and writeback changelog.

The main implementation constraint is not whether the path is possible; it is keeping the runtime boundaries clean so the full feature set stays maintainable.

## Human Gate

Human gate is mandatory in v1.

The agent may audit, reason, classify, and propose rewrites, but it must not directly mutate Figma without a human approval decision recorded by the app.

The human gate applies to:

- Replacing Figma text nodes.
- Creating comments or annotations in Figma.
- Applying bulk changes.
- Retrying failed writeback operations.
- Exporting or sharing reports that include sensitive product context, if the user marks the project as sensitive.

Each proposed change should move through an explicit state machine:

```text
detected
-> proposed
-> approved | edited | rejected
-> queued_for_writeback
-> applied | failed | skipped
```

Rules:

- The default state after LLM review is `proposed`, not `approved`.
- A user can approve one item, approve a filtered group, or approve all visible items.
- If the user edits a proposed rewrite, the edited text becomes the approved candidate.
- Rejected items must remain in the report with rejection status.
- The daemon must reject writeback tool calls that do not reference approved change IDs.
- The report must show which changes were agent-proposed, user-edited, approved, rejected, applied, or failed.

This human gate is a product requirement and a platform safety boundary.

### Electron Desktop Shell

The Electron app provides the product surface and desktop capabilities:

- Review queue UI for audit findings and rewrite approvals.
- Figma import and scope selection UI.
- Brand voice and product context setup.
- Side report viewer and export controls.
- Local folder picker.
- PDF export.
- Local file open/save flows.
- Secure handoff to the local daemon for privileged operations.

The Electron shell should not directly own LLM execution, Figma mutation, or local filesystem writes. Those should go through the daemon so permissions, logging, and audit trails are centralized.

### Local Daemon

The daemon is the platform core. It should run locally and expose a private API to the Electron app.

Responsibilities:

- Manage projects, review sessions, audit reports, and generated artifacts.
- Connect to local agent CLIs through adapters.
- Connect to MCP servers, especially Figma MCP.
- Provide web/network tools for research, link checking, and external context gathering.
- Own local filesystem reads/writes, folder imports, report exports, and PDF generation.
- Store audit logs, approval decisions, and Figma writeback history.
- Enforce permission gates before destructive actions.

### Agent Adapter Layer

The daemon should be able to choose and launch local agent CLIs, similar to Open Design:

- Claude Code.
- Codex.
- Cursor Agent.
- Other compatible agent CLIs later.

The adapter layer should normalize:

- Agent detection.
- Authentication/status checks.
- Prompt and context injection.
- Tool availability.
- Streaming output.
- Cancellation and retry behavior.
- Capability differences between agents.

The product should not assume one model provider or one agent runtime.

### Tool Runtime

Agent actions should be exposed as tools instead of hidden service calls.

Initial tool categories:

- Figma read tools: read file, page, frame, text nodes, component context, screenshots, design tokens.
- Figma write tools: add comments, create annotations, replace approved text nodes, write change markers.
- Web tools: fetch URLs, search or retrieve public context when allowed.
- File tools: read/write local reports, export markdown, JSON, CSV, PDF.
- Review tools: create finding, propose rewrite, mark issue severity, attach rationale.
- Approval tools: request user approval before applying text changes.

Write tools should require explicit approval, especially Figma text replacement.

### MCP Layer

MCP is a first-class integration layer. The first critical MCP server is Figma MCP, with both read and write capabilities.

Required Figma MCP capabilities:

- Read selected frames or Figma URLs.
- Extract text nodes with stable identifiers.
- Read visual/design context around text nodes.
- Read component or design-system context where available.
- Create comments or annotations.
- Apply approved text replacements.
- Return enough metadata to build a reliable audit trail.

The architecture should allow additional MCP integrations later, such as Linear, Notion, Drive, GitHub, or analytics sources.

### Figma Writeback Contract

Figma writeback is a first-class v1 feature.

The writeback path should support two output modes:

- Comments or annotations: attach findings and rewrite suggestions without changing source text.
- Text replacement: update approved text nodes directly in Figma.

Every writeback operation must carry:

- Figma file key, page/frame context, and node id.
- Original text snapshot.
- Proposed replacement text.
- User approval decision.
- Timestamp.
- Agent/model/run metadata.
- Write result from Figma MCP.
- Error details if the write fails.

Writeback should be resumable. If one node fails, the app should preserve the successful writes and show the failed items for retry instead of treating the whole batch as lost.

### Permission And Audit Model

The platform should treat Figma writes like code edits:

- Show the original text, proposed text, location, rationale, and risk.
- Require user approval before writeback.
- Allow approve, reject, edit before apply, and apply all approved.
- Record who approved, when, and what changed.
- Keep a rollback/changelog path where Figma API support allows it.
- Enforce approved change IDs at the daemon layer, not only in the UI.

Audit logs are a product feature, not internal debug data.

## Architecture Inspirations

Open Design provides the closest platform reference:

- Electron/desktop shell for local user experience.
- Local daemon for privileged operations.
- Agent adapters for Claude Code, Codex, Cursor Agent, and other CLIs.
- Tool/MCP runtime as the integration surface.
- Local artifacts and export pipeline.

Claude Code provides the closest agent-runtime reference:

- Tool calls as the unit of agent action.
- Central permission gates before destructive operations.
- Read-only tools can run concurrently, write tools should be controlled.
- Skills/plugins can package repeatable workflows.
- MCP tools can extend the runtime without baking every integration into the core.

## Open Additions

The product shape above looks right, but more requirements still need to be added before this becomes a final implementation design.
