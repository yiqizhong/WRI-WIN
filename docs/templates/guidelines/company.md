---
# Required fields — do not remove
id: company
name: Company Guidelines
scope: company
schema: 1
version: "1.0.0"
updatedAt: "2024-01-01T00:00:00Z"
---

Free-form prose here. Describe your brand voice, audience, or writing philosophy.
This text is used by the retrieval system to answer open-ended questions about your standards.

## Rules

# Each rule needs:
#   id        — unique kebab-case slug (used in audit findings; do not change after publishing)
#   do        — what to write (required)
#   dont      — what to avoid (optional but recommended)
#   reason    — why this rule exists (optional; helps auditors)
#   surfaces  — where the rule applies: button | error | empty-state | toast | body | title | other
#   severity  — must | should | may

- id: use-active-voice
  do: Write in active voice so actions are clear and direct.
  dont: Avoid passive constructions like "the form was submitted by you."
  reason: Active voice reduces cognitive load and matches how users think.
  surfaces:
    - body
    - title
  severity: should

- id: lead-with-benefit
  do: Open error messages with what the user can do, not what went wrong.
  dont: Don't open with "Error:" or "Failed to …" as the first word.
  surfaces:
    - error
  severity: must

## Glossary

# Each term needs:
#   id                   — unique kebab-case slug
#   term                 — preferred spelling or phrasing
#   status               — active | deprecated
#   forbidden            — list of spellings or phrases to avoid (triggers a finding when found)
#   forbiddenReplacement — what to use instead (optional; defaults to "term")
#   caseSensitive        — true | false  (false = match any capitalisation)
#   reason               — why this rule exists (optional)

- id: sign-in
  term: Sign in
  status: active
  forbidden:
    - Login
    - Log in
    - log-in
  caseSensitive: false
  reason: Two-word lowercase form is consistent with platform conventions.

- id: email-address
  term: email address
  status: active
  forbidden:
    - e-mail
    - Email Address
  caseSensitive: false
