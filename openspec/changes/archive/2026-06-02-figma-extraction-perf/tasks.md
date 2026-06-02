## 1. Cap extraction at 500 nodes

- [x] 1.1 Add `MAX_EXTRACTION_NODES = 500` constant and `WRITER_FIGMA_MAX_NODES` env override to `figma-extract-mcp.ts`
- [x] 1.2 After collecting all text refs (including instance-scan), slice to `MAX_EXTRACTION_NODES` before reading
- [x] 1.3 Record a non-fatal diagnostic in the extraction warnings when truncation occurs ("Analyzed the first N of M text nodes")
- [x] 1.4 Write unit tests: 600 refs → 500 read + diagnostic present; 300 refs → all 300 read, no diagnostic

## 2. Bounded-concurrency parallel reads

- [x] 2.1 Replace the sequential `for` loop in `extractFigmaTextNodesViaMcp` with an inline promise pool
- [x] 2.2 Add `EXTRACTION_CONCURRENCY = 8` constant and `WRITER_FIGMA_READ_CONCURRENCY` env override
- [x] 2.3 Collect results into a `results[index]` array to preserve original reference order
- [x] 2.4 Write unit tests: all nodes read; results in original order; one slow/throwing node does not block or drop others; pool never exceeds concurrency limit

## 3. Live progress callback

- [x] 3.1 Add optional `onProgress?: (p: { completed: number; total: number }) => void` parameter to `extractFigmaTextNodesViaMcp`
- [x] 3.2 Invoke `onProgress` once per completed node (inside the pool, after `buildTextNode` resolves)
- [x] 3.3 In `apps/daemon/src/guideline-generation.ts`, wire `onProgress` to `updateGuidelineGenerationProgress` with `progressMessage: "Reading text from Figma… <completed> / <total>"`
- [x] 3.4 Throttle daemon-side progress writes to at most once per second using a `lastWriteMs` closure
- [x] 3.5 Write unit tests: callback fires once per completed node; `completed` is monotonically increasing up to `total`; no callback provided → extraction completes normally

## 4. Typecheck and regression

- [x] 4.1 Run `npm run typecheck` — zero errors
- [x] 4.2 Run `npm run test` — existing `guideline-generation` tests and all `figma-extract-mcp` tests pass
