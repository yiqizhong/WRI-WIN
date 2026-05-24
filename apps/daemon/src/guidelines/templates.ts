export const COMPANY_BASE_MD_TEMPLATE = `---
id: company-base
name: Company Base
layer: company-base
schema: 1
version: "1.0.0"
updatedAt: "${new Date().toISOString()}"
---

Describe your brand voice, values, and tone. This prose is injected into audits as brand context.

## Rules

- id: example-brand-rule
  do: Match the brand voice described above.
  surfaces:
    - body
  severity: should
`;

export const SOFTWARE_WRITING_MD_TEMPLATE = `---
id: software-writing
name: Software Writing
layer: software-writing
schema: 1
version: "1.0.0"
updatedAt: "${new Date().toISOString()}"
---

Cross-product UX writing standards (buttons, errors, empty states, etc.).

## Rules

- id: button-labels-active
  do: Use active voice in button labels.
  surfaces:
    - button
  severity: must

- id: error-messages-actionable
  do: State what went wrong and what the user can do next.
  surfaces:
    - error
  severity: must

- id: empty-states-helpful
  do: Explain why the view is empty and offer a clear next step.
  surfaces:
    - empty-state
  severity: should
`;

export const PRODUCT_BACKGROUND_MD_TEMPLATE = `---
id: my-product
name: My Product
audience: Who uses this product
environment: Where they use it (web, mobile, etc.)
purpose: What they are trying to accomplish
schema: 1
version: "1.0.0"
updatedAt: "${new Date().toISOString()}"
---

Product-specific context prose for audits.
`;

export const PRODUCT_WRITING_GUIDE_MD_TEMPLATE = `---
id: my-product-guide
name: My Product Writing Guide
layer: product-writing
productId: my-product
schema: 1
version: "1.0.0"
updatedAt: "${new Date().toISOString()}"
---

## Rules

- id: product-specific-rule
  do: Use product-specific terminology consistently.
  surfaces:
    - body
  severity: should
`;

/** @deprecated use COMPANY_BASE_MD_TEMPLATE */
export const GUIDELINE_MD_TEMPLATE = COMPANY_BASE_MD_TEMPLATE;
