## MODIFIED Requirements

### Requirement: Glossary forbidden-term matching is crash-safe and case-aware

The stub audit SHALL detect forbidden glossary terms and produce a rewrite to the
preferred term without compiling author-supplied content as an executable regular
expression, and SHALL honor each term's `caseSensitive` flag on both detection and
replacement.

#### Scenario: Forbidden term containing regex metacharacters

- **WHEN** a glossary term forbids a literal containing regex metacharacters (e.g. `"C++"`) and the audited copy contains it
- **THEN** the audit produces a terminology finding and a rewrite whose `after` replaces the literal with the preferred term, and the run does not throw

#### Scenario: Case-sensitive term does not match a differently-cased occurrence

- **WHEN** a glossary term is `caseSensitive: true`, forbids `"APIKEY"`, and the copy contains `"apikey"`
- **THEN** no terminology finding is produced

#### Scenario: Case-sensitive term replaces only the exact-case occurrence

- **WHEN** a glossary term is `caseSensitive: true`, forbids `"APIKEY"`, and the copy contains `"APIKEY"`
- **THEN** the rewrite `after` replaces `"APIKEY"` with the preferred term

### Requirement: Audit fallback rationale is honest

A ReviewChange seeded from Figma extraction SHALL carry neutral pending wording
until an audit pass (LLM, or stub glossary match) actually evaluates the node;
the daemon SHALL NOT assert that copy was checked and found clean before any pass
has run.

#### Scenario: Node seeded but no audit pass has run

- **WHEN** a Figma TEXT node is seeded as a ReviewChange and no audit pass has yet evaluated it
- **THEN** its rationale indicates the copy is awaiting AI review, not that no issues were found

#### Scenario: LLM audit run fails

- **WHEN** the LLM audit run throws or returns no parseable results
- **THEN** the daemon logs the cause and the audit completes using the stub/seed baseline rather than failing

### Requirement: LLM audit output is treated as untrusted

The daemon SHALL apply LLM audit suggestions only to the `after` field of an
already-existing ReviewChange matched by `sourceId`, and SHALL discard suggestions
whose id does not match an existing change. LLM output SHALL never be executed or
written back to Figma without human review.

#### Scenario: Suggestion for an unknown node id

- **WHEN** the LLM returns a result whose `id` does not match any existing ReviewChange
- **THEN** the suggestion is dropped and no change is created

#### Scenario: Suggestion for a known node id

- **WHEN** the LLM returns `changed: true` with a suggestion for a known `sourceId`
- **THEN** only that change's `after` is updated and it remains in `proposed` status pending human review
