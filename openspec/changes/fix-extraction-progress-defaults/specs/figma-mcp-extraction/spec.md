## MODIFIED Requirements

### Requirement: Progress Reporting

The extraction function SHALL accept an optional `onProgress` callback
`(p: { stage: "metadata" | "scanning" | "reading"; completed: number; total: number }) => void`.
When provided, the callback MUST be invoked once per resolved node with a `completed` value
that is strictly monotonically increasing (1, 2, 3, … total), regardless of which worker slot
resolves first. `total` MUST equal the number of capped refs being processed. `stage` MUST
reflect the current extraction phase: `"metadata"` during metadata fetch, `"scanning"` during
instance scanning, and `"reading"` during per-node text reads.

#### Scenario: Monotonic progress under concurrency
- **WHEN** `extractFigmaTextNodesViaMcp` runs with 8 concurrent workers on 20 nodes
- **THEN** each `onProgress` call receives a `completed` value strictly greater than the previous call's `completed` value

#### Scenario: Progress without callback
- **WHEN** no `onProgress` argument is provided
- **THEN** the function completes normally and returns the full extraction result

---

## MODIFIED Requirements

### Requirement: Node Count Cap

The system SHALL cap the total number of text-node references read during extraction
at `MAX_EXTRACTION_NODES` (default 500). `MAX_EXTRACTION_NODES` MUST be overridable
via the `WRITER_FIGMA_MAX_NODES` environment variable, including when the override
value is `0`. `EXTRACTION_CONCURRENCY` (default 8) MUST be overridable via
`WRITER_FIGMA_READ_CONCURRENCY`, including when the override value is `0`. When
the frame contains more nodes than the cap, the system MUST record a non-fatal
`partial_read_failure` diagnostic in `extraction.warnings` and proceed with the
capped set.

#### Scenario: Cap with env override set to zero
- **WHEN** `WRITER_FIGMA_MAX_NODES=0` is set in the environment
- **THEN** `MAX_EXTRACTION_NODES` resolves to `0` (not the default `500`)

#### Scenario: Concurrency override set to zero
- **WHEN** `WRITER_FIGMA_READ_CONCURRENCY=0` is set in the environment
- **THEN** `EXTRACTION_CONCURRENCY` resolves to `0` (not the default `8`)

#### Scenario: Partial extraction warning
- **WHEN** a frame has more text nodes than `MAX_EXTRACTION_NODES`
- **THEN** `extraction.warnings` contains exactly one entry with `code: "partial_read_failure"` and `severity: "info"`
