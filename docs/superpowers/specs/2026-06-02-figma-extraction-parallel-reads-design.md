# Parallel, Capped Figma Text Extraction with Live Progress

Date: 2026-06-02
Status: Approved design, ready for implementation planning

## Problem

Generating writing guidelines from a Figma frame stalls for tens of minutes and looks frozen. A real run on the "Dell Audio / DAMA" frame sat in the `extracting_figma` stage for 35+ minutes with no visible progress before it was canceled.

Root cause: the extractor reads Figma **one text node at a time, sequentially**. For each text-node reference it makes one (sometimes two) remote `use_figma` / `get_design_context` calls to `mcp.figma.com`, and `use_figma` runs an agent on Figma's side — seconds to tens of seconds per call. A content-heavy frame has dozens-to-hundreds of text nodes, so the sequential loop becomes dozens-to-hundreds of slow remote round-trips. There is:

- no parallelism (calls are strictly sequential),
- no cap on how many nodes are read,
- no per-node progress (the message is set once to "Reading text from Figma…" and never updated).

The daemon does not hang or crash — it is genuinely still working through the loop — but the run can exceed half an hour and appears frozen.

Evidence: `apps/daemon/src/guideline-generation.ts` calls `extractFigmaTextNodesViaMcp` once and awaits it; the sequential read loop lives in `packages/review-core/src/figma-extract-mcp.ts:128`; `apps/daemon/src/mcp-client.ts:277` issues each `callTool` with no options (only the SDK's default per-call timeout, nothing capping the total).

## Goals

- Extraction completes in a fraction of the time via bounded-concurrency parallel reads.
- The run always shows live progress ("Reading text from Figma… 240 / 500").
- A hard cap of 500 text nodes bounds cost on very large frames; the run still completes normally and records that the cap was applied.
- No overall time limit — the run is allowed to run to completion.

## Non-Goals (YAGNI)

- A single frame-wide scan replacing per-node reads (faster but no incremental progress, and payload-size risk).
- User-configurable concurrency in the UI.
- Resumable / "continue with the next batch" flows.
- Any change to downstream stages (candidate building, semantic analysis, generation).

## Design

### 1. Cap the read list at 500 nodes

After `get_metadata` returns the text-node references, take at most the first `MAX_EXTRACTION_NODES = 500` references before reading characters. When the frame has more, record a diagnostic such as "Analyzed the first 500 of N text nodes." The run proceeds normally with the capped set.

- Constant `MAX_EXTRACTION_NODES = 500`, with an optional `WRITER_FIGMA_MAX_NODES` env override to match the codebase's existing `WRITER_*` configuration pattern.
- The cap applies to the total extracted node count, including any nodes discovered by the instance scan.

### 2. Read in parallel with bounded concurrency

Replace the sequential loop in `extractFigmaTextNodesViaMcp` with a bounded worker pool (`EXTRACTION_CONCURRENCY = 8`) that calls the existing `buildTextNode` per node. No time limit — the pool runs until all capped nodes are read.

- Results are reassembled in the original reference order so output is stable across runs.
- A slow or failing single node never blocks the others; `buildTextNode` already degrades to a fallback node on error.
- Concurrency constant with an optional `WRITER_FIGMA_READ_CONCURRENCY` env override.

### 3. Live progress callback

Thread an optional progress callback from the daemon into `extractFigmaTextNodesViaMcp`. Each completed node increments a counter; the extractor invokes the callback with `{ completed, total }`.

- The daemon's callback writes `progressMessage: "Reading text from Figma… <completed> / <total>"` via the existing `updateGuidelineGenerationProgress`.
- Writes are throttled (about once per second, or every N completed nodes) to avoid hammering the session store.
- The existing UI already renders `progressMessage`, so progress appears with no UI change required.

## Data Flow

1. Daemon enters `extracting_figma`, calls `extractFigmaTextNodesViaMcp(scope, caller, onProgress)`.
2. Extractor fetches `get_metadata`, derives text-node refs, caps them at 500 (records a diagnostic if truncated).
3. A worker pool of 8 reads node characters concurrently; each completion fires `onProgress({ completed, total })`.
4. Daemon throttles those into `progressMessage` updates the UI polls and displays.
5. When all reads finish, extraction returns nodes in original order; downstream stages run unchanged.

## Error Handling

- Per-node read failure → existing fallback node (name-derived characters); logged, not fatal.
- Figma disconnected before extraction → unchanged early `mcp_not_ready` failure.
- Cap applied → non-fatal diagnostic surfaced in the run summary.
- No time-based failure path — the run is not aborted on elapsed time.

## Testing

- **Cap:** 600 refs → exactly 500 read; truncation diagnostic present; 300 refs → all 300 read, no diagnostic.
- **Concurrency pool:** all nodes read; results in original order; one slow/throwing node does not block or drop the others; never exceeds the concurrency limit.
- **Progress callback:** fires once per completed node with a monotonically increasing `completed` up to `total`.
- Existing `guideline-generation` tests continue to pass (extractor signature change is additive/optional).

## Open Dependencies

None. All changes are within `packages/review-core` (extractor) and `apps/daemon` (progress wiring); no contract or UI changes required.
