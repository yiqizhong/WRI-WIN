# Writer — Product context

## Register

**product** — Desktop tool UI for designers and content designers running Figma copy audits. Design serves the task; familiarity and trust beat decorative novelty.

## Users

- **Designers** reviewing Figma screens before handoff (focused 30–90 minute sessions).
- **PMs / content designers** auditing terminology, buttons, empty states, and tone across files or flows.

**Context:** Local-first Electron app + daemon. Users configure LLM providers and MCP (especially Figma) on the Agents screen, then work in Review and Sources. They are not engineers; connection errors must be plain language with recovery steps.

## Product purpose

Help teams audit, propose, approve, and apply UX/UI copy changes from Figma (or pasted text / spreadsheets) with a mandatory human gate before writeback.

## Brand personality

- **Quiet confidence** — competent, calm, no hype.
- **Direct** — short labels, active voice, specific actions.
- **Trustworthy** — show system status; never hide failures in toasts that disappear.

## Anti-references

- Generic “AI dashboard” aesthetics (gradient heroes, glassmorphism, metric cards).
- Engineer-facing errors (`needs_auth`, raw enum statuses in UI).
- Disappearing toasts for connection or auth failures.
- Reinventing Carbon patterns with one-off pink alert boxes.

## Strategic design principles

1. **Human gate** — LLM proposes; humans approve before Figma mutation.
2. **Daemon owns privilege** — Desktop is control surface only (agents, MCP, files).
3. **State visibility** — Loading, refreshing, testing, and OAuth flows show inline feedback (L04).
4. **Operator screen isolation** — Agents/MCP diagnostics live on Agents, not duplicated on Review.
5. **Restrained color** — Carbon tokens; accent for primary actions and selection only.

## Accessibility

- WCAG AA target for text contrast and keyboard operation.
- All interactive controls reachable by keyboard; visible focus.
- Connection/status updates exposed to assistive tech (`role="alert"` on errors).
- Plain-language labels; avoid unexplained acronyms in primary copy (spell out MCP once where needed).
