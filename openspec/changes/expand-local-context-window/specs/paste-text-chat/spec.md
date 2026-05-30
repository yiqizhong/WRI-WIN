## MODIFIED Requirements

### Requirement: Conversation history in prompt

The system SHALL include snapshotted guideline blocks, conversation background, and recent message history when assembling the LLM prompt. Guideline layers SHALL be emitted in priority order: Company Base, Software Writing, Product-specific. The system prompt SHALL instruct the model to prefer Product over Software Writing over Company Base on rule conflict. The system SHALL trim included message history to a token budget derived from the active context window (reserving space for guideline/background context and the model's reply), keeping the most recent turns and always retaining the current user message; an existing message-count cap MAY apply as a secondary bound.

#### Scenario: Multi-turn context

- **WHEN** user sends a second message in the same conversation
- **THEN** prompt includes guideline snapshot layers (when present), `backgroundContext`, project brand voice (if set), and prior turns (within the token budget)

#### Scenario: Multi-turn context with three layers

- **WHEN** user sends a second message in a conversation whose snapshot contains all three layers
- **THEN** the assembled prompt contains three `Writing rules (…)` sections in priority order
- **AND** the system prompt contains the conflict-resolution instruction
- **AND** prior user/assistant turns appear after the rules sections (within the token budget)

#### Scenario: Missing layer

- **WHEN** the snapshot contains only Company Base + Product (no Software Writing layer was discovered)
- **THEN** the assembled prompt emits only the two present sections
- **AND** the conflict-resolution instruction still appears
- **AND** no placeholder text is emitted for the missing layer

#### Scenario: History exceeds the token budget

- **WHEN** the accumulated message history would push the assembled prompt past the token budget for the active context window
- **THEN** the system drops the oldest turns (sliding window) until the prompt fits
- **AND** always retains the current user message
- **AND** does not fail the request because of conversation length
