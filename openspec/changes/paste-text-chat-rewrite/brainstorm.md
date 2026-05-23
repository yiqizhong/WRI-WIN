# Brainstorm · Paste Text Chat Rewrite

## Background

Writer already has:
- `POST /sessions/pasted-text` — single-shot session creation from textarea
- `POST /spreadsheet/parse` — CSV/XLSX parse via local file path
- `POST /review/context` + `POST /agents/runs` — LLM path exists but is **not wired** to desktop paste flow
- Review audit uses **stub heuristics**, not the active LLM adapter

Product intent (user + `2026-05-22-figma-ux-copy-review-design.md`): unify plain-text paste and spreadsheet intake into one **chatbot-style** surface. User supplies UI background + copy; system returns optimized text per preset writing rules. User copies result = output.

## Decision chain

### Q1: Replace or extend existing Sources flow?
**Decision:** Extend and eventually replace the three-tile Sources layout with one chat surface. v1 keeps Review queue optional; chat returns copy-ready suggestions directly (light-edit path).

### Q2: Two modes — how to represent?
**Decision:** Single conversation with `inputKind`:
- `plain_text` — user message is raw copy (+ optional background in session settings)
- `structured_file` — user attaches CSV/XLSX; daemon parses rows; each user message can target a row or batch

### Q3: LLM integration path?
**Decision:** Reuse `POST /agents/runs` via new daemon orchestration layer `paste-text-rewrite` — do not add a second LLM client. Prompt assembled by dedicated Copywriter Skill module.

### Q4: Output shape?
**Decision v1:** Assistant message = `{ suggestedText, rationale? }` as plain text/markdown in response. No findings/approval queue required for chat turn (queue remains for batch audit later).

### Q5: Background / writing rules injection?
**Decision:** Pre-conversation `backgroundContext` (UI context) + project `brandVoice` + fixed Copywriter Skill system prompt. Skill hard-limits scope: rewrite only, no general chat.

### Q6: File upload transport?
**Decision:** Electron file picker → local path → daemon (same as spreadsheet today). v1 no multipart HTTP. Attachment record stores `{ filePath, parseResult? }`.

## Approaches considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| A. New chat API + skill layer on agents | Reuses adapters, minimal duplication | Need conversation persistence | **Recommended** |
| B. Extend `/review/audit/run` for chat | One audit pipeline | Audit = findings model, wrong UX for copy-paste | Rejected |
| C. Desktop-only prompt + direct CLI | Fast prototype | Violates architecture (renderer runs agents) | Rejected |

## Design trade-offs

- **Unified surface** reduces Sources cognitive load but Issue 4 (UI) ships after backend stable.
- **Plain-text-first** delivers value before spreadsheet row UX in chat.
- **Skill hardcoding** trades flexibility for predictable outputs (user requirement).

## Open questions (deferred)

- Multi-turn refinement in v1: **yes** — conversation history included in prompt (last N turns).
- Streaming tokens to UI: **v2** — v1 returns complete assistant message after run completes.

## Approval

User provided detailed spec 2026-05-23; proceeding to OpenSpec artifacts + Linear issues + Issue 1 implementation.
