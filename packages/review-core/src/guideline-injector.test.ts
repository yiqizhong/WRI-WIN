import { describe, expect, it } from "vitest";

import { buildGuidelinePromptSection, injectGuidelineContext } from "./guideline-injector";

const threeLayerSnapshot = {
  companyBase: {
    id: "company-base",
    name: "Company Base",
    layer: "company-base" as const,
    schema: 1,
    version: "1.0.0",
    updatedAt: "2024-01-01T00:00:00Z",
    body: "We sound friendly and direct.",
    rules: [],
    glossary: []
  },
  softwareWriting: {
    id: "software-writing",
    name: "Software Writing",
    layer: "software-writing" as const,
    schema: 1,
    version: "1.0.0",
    updatedAt: "2024-01-01T00:00:00Z",
    rules: [
      {
        id: "btn-active",
        do: "Use verbs on buttons",
        surfaces: ["button" as const],
        severity: "must" as const
      }
    ],
    glossary: []
  },
  companyGlossary: [
    {
      id: "sign-in",
      term: "Sign in",
      status: "active" as const,
      forbidden: ["Login"],
      caseSensitive: false
    }
  ],
  productPackage: {
    id: "checkout",
    name: "Checkout",
    background: {
      id: "checkout",
      name: "Checkout",
      audience: "Shoppers",
      environment: "Web",
      purpose: "Buy items",
      body: "Checkout flow copy.",
      schema: 1,
      version: "1.0.0",
      updatedAt: "2024-01-01T00:00:00Z"
    },
    glossary: [],
    writingGuide: {
      id: "checkout-guide",
      name: "Checkout Guide",
      layer: "product-writing" as const,
      productId: "checkout",
      schema: 1,
      version: "1.0.0",
      updatedAt: "2024-01-01T00:00:00Z",
      rules: [
        {
          id: "short-labels",
          do: "Keep labels short",
          surfaces: ["button" as const],
          severity: "should" as const
        }
      ],
      glossary: []
    }
  },
  contentHashes: {},
  capturedAt: "2024-01-01T00:00:00Z"
};

describe("injectGuidelineContext (3-layer)", () => {
  it("assembles brand, product context, rules, and glossary", () => {
    const ctx = injectGuidelineContext(threeLayerSnapshot, "button", "Click Login to continue");
    expect(ctx.proseBlock).toContain("# Brand voice");
    expect(ctx.proseBlock).toContain("friendly and direct");
    expect(ctx.proseBlock).toContain("# Product context: Checkout");
    expect(ctx.proseBlock).toContain("Audience: Shoppers");
    expect(ctx.rulesBlock).toContain("btn-active");
    expect(ctx.rulesBlock).toContain("short-labels");
    expect(ctx.glossaryBlock).toContain("Sign in");
  });

  it("builds a combined prompt section", () => {
    const ctx = injectGuidelineContext(threeLayerSnapshot, "button", "Login");
    const section = buildGuidelinePromptSection(ctx);
    expect(section).toContain("# UX Writing Guidelines");
    expect(section).toContain("# Brand voice");
  });
});
