## Why

Guideline generation stalls in `extracting_figma` for 35+ minutes and appears frozen. The extractor reads Figma text nodes one at a time sequentially — each node costs one or two agent-side MCP calls (seconds to tens of seconds each). On content-heavy frames this becomes hundreds of slow sequential round-trips with no visible progress. Users cancel runs that are genuinely still working. Fixing this now unblocks real usage of the product on non-trivial Figma files.

## What Changes

**Figma text node extraction**
- From: Sequential `for` loop reads one node at a time; no cap; `progressMessage` set once and never updated
- To: Bounded-concurrency pool (8 workers) over a capped set (500 nodes max); `onProgress` callback fires per completed node; daemon writes live progress ("Reading text from Figma… 240 / 500")
- Reason: Sequential reads on large frames take 35+ minutes; parallel reads with a cap bound the worst case
- Impact: Non-breaking — `onProgress` is an optional additive parameter; existing callers unaffected

## Capabilities

### New Capabilities

None — all changes are modifications to the existing `figma-mcp-extraction` capability.

### Modified Capabilities

- `figma-mcp-extraction`: Add node cap (500 nodes, non-fatal diagnostic when truncated), replace sequential loop with bounded-concurrency parallel reads (8 workers, original order preserved), add optional `onProgress` callback threaded from daemon to session `progressMessage`

## Impact

- `packages/review-core/src/figma-extract-mcp.ts` — core extractor rewrite (cap + pool + callback)
- `apps/daemon/src/guideline-generation.ts` — wire `onProgress` to `updateGuidelineGenerationProgress`
- No schema changes, no UI changes, no new dependencies
