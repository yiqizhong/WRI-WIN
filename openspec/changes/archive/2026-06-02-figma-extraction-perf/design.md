## Context

`extractFigmaTextNodesViaMcp` in `packages/review-core/src/figma-extract-mcp.ts` reads Figma text nodes one at a time in a sequential `for` loop (line 128). Each iteration calls `buildTextNode` which issues one or two MCP calls (`use_figma` / `get_design_context`) to `mcp.figma.com` — each an agent-side call costing seconds to tens of seconds. A content-heavy frame with hundreds of nodes translates to hundreds of sequential slow round-trips, causing the `extracting_figma` stage to stall for 35+ minutes with no visible progress.

Affected paths:
- `packages/review-core/src/figma-extract-mcp.ts` — extractor (sequential loop, no cap, no progress)
- `apps/daemon/src/guideline-generation.ts` — caller (awaits extractor, wires progress stage)
- `apps/daemon/src/mcp-client.ts:277` — MCP caller (no options beyond SDK default per-call timeout)

The daemon is not hung — it is genuinely working. The UX problem compounds because `progressMessage` is set once ("Reading text from Figma…") and never updated.

## Goals / Non-Goals

**Goals:**
- Extraction completes in a fraction of the time via bounded-concurrency parallel reads
- UI shows live progress: "Reading text from Figma… 240 / 500"
- Hard cap of 500 text nodes bounds worst-case duration on very large frames
- Non-fatal cap: run completes normally and records a diagnostic when truncated
- Additive, backwards-compatible signature change to extractor

**Non-Goals:**
- Single frame-wide scan rewrite (payload-size risk, loses incremental progress)
- UI-configurable concurrency
- Resumable / continue-batch flows
- Any change to downstream stages (candidate building, semantic analysis, generation)
- Time-based abort of extraction

## Decisions

### D1: No time limit — run to completion
- **Choice:** No overall timeout on extraction
- **Rationale:** A timeout produces false failures — the run is genuinely working. Parallel reads reduce actual duration enough that a cap is sufficient.
- **Alternative considered:** Add a 5-minute wall-clock abort → rejected: confusing to users, masks progress on large legitimate frames

### D2: Cap reads at 500 nodes
- **Choice:** `MAX_EXTRACTION_NODES = 500`, env override `WRITER_FIGMA_MAX_NODES`
- **Rationale:** Bounds worst-case duration; 500 nodes is generous for real frames; cap is transparent (diagnostic recorded, not a silent truncation)
- **Alternative considered:** No cap, rely solely on parallelism → rejected: unbounded on pathological frames

### D3: Cap applies to total node count including instance-scan nodes
- **Choice:** Slice `textRefs` after all refs are collected (including those from `scanInstanceTextNodes`)
- **Rationale:** Single invariant: extractor never reads more than MAX nodes regardless of source. Simpler than per-source caps.

### D4: Bounded-concurrency promise pool (concurrency = 8)
- **Choice:** Inline promise pool, `EXTRACTION_CONCURRENCY = 8`, env override `WRITER_FIGMA_READ_CONCURRENCY`
- **Rationale:** 8 concurrent calls balances throughput vs. Figma MCP server load. Results collected in a `results[index]` array to preserve original reference order.
- **Alternative considered:** External library (p-limit) → rejected: adds a dependency for trivial logic; inline pool is ~20 lines

### D5: Optional `onProgress` callback on extractor
- **Choice:** Add `onProgress?: (p: { completed: number; total: number }) => void` to `extractFigmaTextNodesViaMcp`
- **Rationale:** Fully additive (optional param, existing callers unaffected). Daemon wires it to `updateGuidelineGenerationProgress` → `progressMessage`.
- **Alternative considered:** Return an async iterator / stream → rejected: much larger API change, requires caller restructuring

### D6: Time-based throttle (~1s) on daemon-side progress writes
- **Choice:** Daemon callback records `lastWriteMs` and skips if `Date.now() - lastWriteMs < 1000`
- **Rationale:** Prevents hammering the session store with 8 concurrent completions; 1s is imperceptible to users
- **Alternative considered:** Count-based throttle (every N nodes) → rejected: depends on total count, harder to reason about

## Risks / Trade-offs

[Risk] Figma MCP server rate-limits 8 concurrent calls → Mitigation: `WRITER_FIGMA_READ_CONCURRENCY` env override lets operators reduce concurrency if needed; `buildTextNode` already degrades gracefully per node

[Risk] Instance-scan adds nodes after initial ref collection, making total unpredictable → Mitigation: cap applied after both ref sources are merged, not before

[Trade-off] Cap at 500 may silently miss text nodes on very large frames → Accepted: diagnostic is surfaced in run summary; override available; 500 is far above typical real-frame sizes

[Trade-off] Inline promise pool vs. library → Accepted: ~20 lines, well-tested pattern; avoids new dependency

## Migration Plan

N/A — this change is contained within `packages/review-core` and `apps/daemon`. No endpoint, database, schema, or UI changes. No deployment steps. Rollback = revert the commits.

## Open Questions

None — design is fully resolved.
