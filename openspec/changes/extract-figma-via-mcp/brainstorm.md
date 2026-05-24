# Brainstorm · extract-figma-via-mcp

Captured 2026-05-23 during session where user asked why pasting a Figma frame link produced fake "Continue" / "Review your UX copy before publishing." text.

## Background

- `harden-local-cli-figma-mcp-connections` shipped: MCP server connects via OAuth, `whoami` smoke passes, 18 tools discovered.
- Health endpoint: `/mcp/servers` shows `figma: connected, ready`.
- README's "Known limitations" still lists: "Full Figma extraction and writeback still use bootstrap paths until the next MCP-backed workflow slice."
- That slice was never opened. This change opens it (Slice A; Slice B for the broader 18-tool surface is a separate change).

## Decision chain

**Q1: Scope — frame only, or page + frame + flow + file?**
- Decision: support all four scope kinds the parser already produces (`frame`, `page`, `file`, `flow`).
- Reason: the parser is already there; if we only support frame, page URLs silently degrade.
- Edge: `flow` scope has multiple `nodeIds` — iterate and merge.

**Q2: One MCP call or two per node?**
- Options considered:
  - (a) `get_metadata` alone, parse text characters from XML.
  - (b) `get_metadata` for structure + `get_design_context` per TEXT node for accurate characters and style.
  - (c) `get_design_context` only on the scoped root, trust it to include nested text.
- Decision: **(b)** for v1.
- Reason: `get_metadata` XML doesn't include `characters` field per the tool description ("only includes node IDs, layer types, names, positions and sizes"). We must call `get_design_context` to get real text. Calling per-TEXT-node is more requests but produces a clean `FigmaTextNode[]`.
- Optimization for later: batch / cache; not needed for v1.

**Q3: What happens when MCP is not connected?**
- Decision: return structured `mcp_not_ready` diagnostic, do NOT fall back to stub.
- Reason: silent stubbing is the bug we're fixing. Loud failure with a Connect action is correct UX.

**Q4: Where does the MCP call live — daemon or review-core?**
- Decision: review-core owns the extraction logic, takes an injected `McpCaller` interface. Daemon wires `state.mcp.figmaClient.callTool` into it.
- Reason: review-core stays daemon-agnostic and testable with a fake MCP caller. Same pattern as existing `extractFigmaTextNodes` taking a pure `FigmaReviewScope`.

**Q5: Should this also expose all 18 tools?**
- Decision: NO. Separate change `expose-figma-mcp-tools` (Slice B). Per user direction in chat.
- Reason: Slice A is the user's immediate complaint ("read frame in app"). Slice B (write tools, permission UI) is bigger and benefits from being reviewed on its own.

**Q6: Handle Make files (`/make/`)?**
- Decision: out of scope. Per `get_metadata` tool description: "This tool is not supported for Figma Make Files."
- Reason: parser may produce a Make scope but downstream can't read it; document as non-goal.

## Acceptance

- `npm run typecheck && npm run test` pass.
- New daemon integration test: POST `/sessions` with a Figma URL pointing at a real frame (use a recorded fixture for MCP responses) and verify `/review/audit/run` returns a queue with real characters, not the stub strings.
- Manual: open desktop → Sources → paste a real Figma frame link → Start session → Review screen shows real text from that frame (not "Primary CTA: Continue").
- README "Known limitations" line removed.

## Promotion criteria (all 5 — checked)

1. **Scope locked** — Slice A only: read Page/Frame/File/Flow links via MCP. Write tools, UI for 18 tools, screenshots, streaming all explicit non-goals.
2. **Forks resolved** — Q1–Q6 decided above.
3. **Dependencies mapped** — Figma MCP client (ready), `get_metadata` + `get_design_context` (discovered tools, real), test fixture for MCP (mockable).
4. **Acceptance stateable** — typecheck + test + integration test + manual smoke listed above.
5. **Converging** — user explicit approval of A→B split and opsx flow.
