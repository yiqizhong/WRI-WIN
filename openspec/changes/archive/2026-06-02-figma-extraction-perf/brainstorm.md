<!--
Raw capture of design exploration for figma-extraction-perf.
Design was completed and approved prior to OpenSpec artifact creation.
This document captures the decision log from that exploration.
-->

# Brainstorm: Parallelize + Cap Figma Text Extraction with Live Progress

## Background

Guideline generation stalls for 35+ minutes in `extracting_figma` and appears frozen. A real run on the "Dell Audio / DAMA" frame was canceled after 35 min.

**Root cause confirmed:** `packages/review-core/src/figma-extract-mcp.ts:128` has a sequential `for` loop over text-node refs. Each iteration calls `buildTextNode` → `use_figma` / `get_design_context` on Figma's MCP server — an agent-side call that takes seconds to tens of seconds. A content-heavy frame with hundreds of nodes = hundreds of sequential slow round-trips.

Three compounding problems:
1. No parallelism — strictly sequential reads
2. No cap — unbounded node count, scales to worst case
3. No per-node progress — UI shows "Reading text from Figma…" once and never updates

## Decision Chain

### Q1: Should we add a time limit to abort extraction?

**Decided: No.** A time limit creates false failures — the run is genuinely working. Users would see mysterious aborts. Instead, speed it up so it completes quickly. The run should always terminate successfully (or via existing per-node fallback on failure).

### Q2: Should we rewrite to a single frame-wide scan instead of per-node reads?

**Decided: No (YAGNI).** A single `get_design_context` or `use_figma` on the full frame might be faster but:
- Risk of exceeding payload size limits on large frames
- Loses incremental progress reporting
- Bigger rewrite scope, harder to test
- Keep per-node reads; parallelize them.

### Q3: What concurrency level?

**Decided: 8 workers** (`EXTRACTION_CONCURRENCY = 8`). Balances throughput vs. Figma MCP server load. Too many concurrent calls risks rate-limiting or timeouts on Figma's side. Env override `WRITER_FIGMA_READ_CONCURRENCY` follows existing `WRITER_*` pattern.

### Q4: Should we cap the number of nodes read?

**Decided: Yes, cap at 500** (`MAX_EXTRACTION_NODES = 500`). Rationale:
- Bounds worst-case duration (500 nodes ÷ 8 concurrent ≈ much more reasonable)
- Most real frames have far fewer relevant text nodes
- Non-fatal: record a diagnostic "Analyzed first 500 of N text nodes" and continue
- Env override `WRITER_FIGMA_MAX_NODES` for power users

### Q5: Where does the cap apply — before or after instance scan?

**Decided: Total including instance-scan nodes.** Simpler invariant: the extractor never reads more than MAX_EXTRACTION_NODES nodes regardless of source.

### Q6: How to implement the worker pool?

**Decided: Simple promise-pool pattern inline** (not a library). Cap active promises at concurrency limit. Collect results in a `results[index]` array to preserve original order. Don't add a dependency just for this.

### Q7: How should progress be reported?

**Decided: Callback threading.** Add optional `onProgress: (p: { completed: number; total: number }) => void` to `extractFigmaTextNodesViaMcp`. The daemon wires it to `updateGuidelineGenerationProgress` → `progressMessage`. Throttle writes to ~1/s. The UI already renders `progressMessage` — no UI change needed.

### Q8: Should progress throttling be time-based or count-based?

**Decided: Time-based (~1s interval).** Simpler and more predictable UX. Use `Date.now()` comparison in the callback closure.

## Design Trade-offs Accepted

| Trade-off | Decision |
|-----------|----------|
| Figma MCP load | 8 concurrent calls is a reasonable middle ground; monitor if issues arise |
| Cap = potential information loss | Non-fatal diagnostic ensures transparency; 500 nodes is generous for real frames |
| No resumable batches | YAGNI — adds significant complexity for a rare edge case |
| Additive signature change | `onProgress` is optional, fully backwards-compatible |

## Approved Design Summary

1. **Cap at 500 nodes** — after metadata fetch, slice `textRefs` to 500 before any reads. Record diagnostic if truncated.
2. **Bounded-concurrency pool of 8** — replace sequential `for` loop with promise pool over capped refs, collecting results in original order.
3. **Optional `onProgress` callback** — threaded from daemon, throttled to ~1/s, writes `progressMessage` to session store.

Status: **Approved, ready for implementation planning.**
