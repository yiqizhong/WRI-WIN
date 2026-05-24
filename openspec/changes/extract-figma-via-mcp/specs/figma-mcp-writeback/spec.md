## ADDED Requirements

### Requirement: Approved Frame changes are written through explicit apply
The system SHALL mutate Figma text nodes only after the user explicitly applies changes whose review status is `approved` or `edited`.

#### Scenario: Approval alone does not mutate Figma
- **WHEN** the user approves a proposed rewrite but has not selected Apply approved to Figma
- **THEN** the change becomes writeback-eligible but no Figma MCP write tool is invoked

#### Scenario: Explicit apply writes approved content
- **WHEN** the user applies an approved or edited rewrite for an extracted Frame text node and approves the write permission
- **THEN** the daemon invokes Figma MCP writeback for that original text node id using the final confirmed text and records an `applied` result

### Requirement: Writeback is guarded against unreviewed or stale mutations
The system SHALL enforce approved change identity and shall not overwrite Figma text that changed after it was extracted for review.

#### Scenario: Non-approved item is excluded
- **WHEN** writeback input references a proposed, rejected, or skipped change
- **THEN** the daemon excludes that change from mutation and returns a skipped or rejected result

#### Scenario: Current Figma text conflicts with reviewed source
- **WHEN** the source text node no longer contains the original text reviewed by the user
- **THEN** the daemon reports a `write_conflict` failure for that node and does not overwrite its current content

### Requirement: Partial write failure is recorded accurately
The system SHALL record a result for every attempted approved node write and SHALL NOT report unsuccessful writes as applied.

#### Scenario: One batch item fails
- **WHEN** one eligible text node cannot be modified while sibling nodes are modified successfully
- **THEN** successful siblings become `applied`, the unsuccessful node becomes `failed`, and the failed node remains visible for retry
