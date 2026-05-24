export const GUIDELINE_MD_TEMPLATE = `---
# Required fields. Do not remove.
id: my-guideline
name: My Guideline
scope: company  # or "product"
schema: 1
version: "1.0.0"
updatedAt: "${new Date().toISOString()}"
---

Free-form prose. Describe your brand voice, audience, writing philosophy.
The retrieval system uses this text to answer open questions about your standards.

## Rules

# Each rule needs: id, do, surfaces, severity.
# Optional: dont, reason.
# Surfaces: button | error | empty-state | toast | body | title | other.
# Severity: must | should | may.

- id: example-rule
  do: Write clearly and concisely.
  dont: Avoid jargon and filler words.
  reason: Clear language reduces cognitive load.
  surfaces:
    - body
    - title
  severity: should

## Glossary

# Each term needs: id, term, status, caseSensitive.
# Optional: forbidden (list), forbiddenReplacement, reason.

- id: example-term
  term: Sign in
  status: active
  forbidden:
    - Login
    - Log in
  caseSensitive: false
  reason: Two-word lowercase form.
`;
