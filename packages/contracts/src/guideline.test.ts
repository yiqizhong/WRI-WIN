import { describe, expect, it } from "vitest";

import {
  guidelineSchema,
  productBackgroundSchema,
  productPackageSchema
} from "./guideline";
import {
  createProductInputSchema,
  uploadCompanyBaseInputSchema,
  uploadCompanyGlossaryInputSchema,
  uploadProductBackgroundInputSchema
} from "./guideline-upload";

describe("guideline 3-layer contracts", () => {
  it("accepts company-base guideline", () => {
    const parsed = guidelineSchema.parse({
      id: "company-base",
      name: "Company Base",
      layer: "company-base",
      schema: 1,
      version: "1.0.0",
      updatedAt: "2024-01-01T00:00:00Z",
      rules: [],
      glossary: []
    });
    expect(parsed.layer).toBe("company-base");
  });

  it("accepts product-writing layer without strict productId requirement", () => {
    const parsed = guidelineSchema.parse({
      id: "checkout-rules",
      name: "Checkout",
      layer: "product-writing",
      body: "Freeform writing guide text.",
      rules: [],
      glossary: []
    });
    expect(parsed.layer).toBe("product-writing");
  });

  it("accepts freeform product background content", () => {
    const bg = productBackgroundSchema.parse({
      id: "checkout",
      name: "Checkout",
      content: "Any notes the team wants — no YAML required."
    });
    expect(bg.content).toContain("Any notes");
  });

  it("accepts product package with glossary text", () => {
    const pkg = productPackageSchema.parse({
      id: "checkout",
      name: "Checkout",
      glossaryContent: "term,preferred\nSign in,Sign in\n"
    });
    expect(pkg.glossaryContent).toContain("Sign in");
  });

  it("accepts upload inputs for fixed slots", () => {
    expect(uploadCompanyBaseInputSchema.parse({ content: "# Brand" }).content).toBe("# Brand");
    expect(
      uploadCompanyGlossaryInputSchema.parse({ content: "id,term", format: "csv" }).format
    ).toBe("csv");
    expect(
      createProductInputSchema.parse({
        id: "checkout",
        files: [{ filename: "background.md", content: "# Checkout\n\nNotes." }]
      }).id
    ).toBe("checkout");
    expect(
      uploadProductBackgroundInputSchema.parse({
        productId: "ddpm",
        content: "# Notes",
        sourceFilename: "DDPM Product Context.md"
      }).sourceFilename
    ).toBe("DDPM Product Context.md");
  });
});
