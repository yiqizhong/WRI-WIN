## ADDED Requirements

### Requirement: Guideline file discovery

The daemon SHALL discover guideline files from `~/.writer/guidelines/` on startup and on filesystem change events.

#### Scenario: Company file present

- **WHEN** `~/.writer/guidelines/company.md` exists and parses successfully
- **THEN** `GET /guidelines` returns the company entry with `parseStatus: ok`

#### Scenario: Product files in subdirectory

- **WHEN** `~/.writer/guidelines/products/checkout.md` exists alongside `company.md`
- **THEN** `GET /guidelines` returns both entries and the product's rules include items with `inheritedFrom: 'company'`

#### Scenario: Missing company file

- **WHEN** `company.md` does not exist
- **THEN** `GET /guidelines` returns an empty list and a `companyMissing: true` flag

#### Scenario: First-run scaffold

- **WHEN** the daemon starts and `~/.writer/guidelines/` does not exist
- **THEN** the daemon creates the directory and writes a starter `company.md` with frontmatter, one example rule, and one example term

### Requirement: Markdown + YAML parsing

The daemon SHALL parse each `.md` file as YAML frontmatter for metadata plus YAML lists inside `## Rules` and `## Glossary` sections for structured content.

#### Scenario: Valid structured file

- **WHEN** a file contains valid frontmatter and well-formed Rules / Glossary lists
- **THEN** parsing succeeds and the resulting Guideline matches `guidelineSchema`

#### Scenario: Parse failure drops the entire file

- **WHEN** any frontmatter field or any Rules/Glossary entry fails Zod validation
- **THEN** the file is dropped with `parseStatus: error` and `parseError` contains file path and line number

#### Scenario: Duplicate IDs refuse the tree

- **WHEN** two rules or terms share an `id` within a file or across `company.md` and any product file
- **THEN** the entire tree is rejected and `GET /guidelines` reports a conflict error listing both file paths

### Requirement: Filesystem watch and reload

The daemon SHALL watch the guidelines directory and update its parse cache when files change.

#### Scenario: Edit reflected after save

- **WHEN** a user saves a change to `company.md`
- **THEN** within 2 seconds the daemon re-parses the file and emits a `guidelines:changed` SSE event

#### Scenario: Manual reload

- **WHEN** `POST /guidelines/reload` is called
- **THEN** the daemon re-scans the directory and `GET /guidelines` returns the updated list

### Requirement: Guideline retrieval interface

The daemon SHALL expose a `GuidelineIndex` with `rulesBySurface(surface)`, `termsByLiteral(text)`, and `searchProse(query, limit)` methods.

#### Scenario: Surface filter exactness

- **WHEN** `rulesBySurface('button')` is called for a product guideline
- **THEN** only rules whose `surfaces` includes `'button'` are returned, including inherited company rules

#### Scenario: Literal term match honors case sensitivity

- **WHEN** `termsByLiteral('Login')` is called and a term has `forbidden: ['Login', 'Log in']` with `caseSensitive: false`
- **THEN** the term entry is returned

#### Scenario: Prose chunk ID stability

- **WHEN** the same file content is re-parsed twice
- **THEN** chunk IDs returned by `searchProse` are identical across the two parses

### Requirement: Session snapshot

The audit session record SHALL embed a snapshot of the active guideline at session creation.

#### Scenario: Snapshot captures parsed view and hashes

- **WHEN** an audit session is created with `activeGuidelineId` set
- **THEN** the session record contains the parsed Guideline plus a content hash for each source file

#### Scenario: Re-run uses snapshot, not latest file content

- **WHEN** the source `.md` is edited after a session is created and the session's audit is re-run
- **THEN** the audit uses the embedded snapshot, not the current file content

### Requirement: Audit prompt injection

The audit pipeline SHALL inject structured rules and glossary entries plus retrieved prose chunks into the LLM prompt.

#### Scenario: Surface-scoped rules included in full

- **WHEN** an audit runs against a frame classified as surface `button`
- **THEN** the system prompt contains every `button`-scoped rule from the snapshot

#### Scenario: Glossary literal matches included in full

- **WHEN** the audited text contains a literal match for a forbidden glossary term
- **THEN** that term entry is included in the system prompt

#### Scenario: Prose top-K retrieval

- **WHEN** the snapshot contains prose chunks
- **THEN** the top-K (default 5) chunks scored by keyword overlap against the audited text are included with their stable chunk IDs

### Requirement: Finding traceback validation

The daemon SHALL reject findings whose `ruleId` or `termId` is not present in the session snapshot or whose `evidence.quote` is not a substring of the audited text.

#### Scenario: Hallucinated ruleId dropped

- **WHEN** an LLM finding cites `ruleId: 'nonexistent-id'`
- **THEN** the finding is not written to the review queue and the audit log records reason `invalid_rule_id`

#### Scenario: Quote not in audited text dropped

- **WHEN** an LLM finding cites `evidence.quote: 'Click here'` and the audited text does not contain that substring
- **THEN** the finding is dropped with reason `evidence_not_found`

#### Scenario: Deterministic glossary findings bypass LLM

- **WHEN** a forbidden glossary term literally occurs in the audited text
- **THEN** the daemon emits a finding with `source: 'glossary'` without invoking the LLM

### Requirement: Per-project guideline binding

The platform store SHALL record an optional `activeGuidelineId` per project.

#### Scenario: Save and reload binding

- **WHEN** a project's `activeGuidelineId` is set
- **THEN** subsequent reads of that project return the same binding

#### Scenario: Company-only audit

- **WHEN** `activeGuidelineId` equals the company guideline id
- **THEN** audits run grounded in company rules only

#### Scenario: No binding disables grounding

- **WHEN** `activeGuidelineId` is unset
- **THEN** audits run without guideline injection (pre-change behavior preserved)

### Requirement: Importer abstraction

The daemon SHALL expose an `Importer` interface (`canHandle(filePath)`, `parse(filePath)`); only `MarkdownImporter` is registered in v1.

#### Scenario: Unknown file type ignored

- **WHEN** a `.pdf` file is placed in `~/.writer/guidelines/`
- **THEN** no importer claims it and `GET /guidelines` does not list it
