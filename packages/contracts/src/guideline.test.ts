import { describe, expect, it } from "vitest";

import {
  guidelineSchema,
  productBackgroundSchema,
  productPackageSchema
} from "./guideline";
import {
  createProductInputSchema,
  uploadCompanyBaseInputSchema,
  uploadCompanyGlossaryInputSchema
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

  it("requires productId for product-writing layer", () => {
    expect(() =>
      guidelineSchema.parse({
        id: "checkout-rules",
        name: "Checkout",
        layer: "product-writing",
        schema: 1,
        version: "1.0.0",
        updatedAt: "2024-01-01T00:00:00Z",
        rules: [],
        glossary: []
      })
    ).toThrow();
  });

  it("accepts product background with required context fields", () => {
    const bg = productBackgroundSchema.parse({
      id: "checkout",
      name: "Checkout",
      audience: "Merchants",
      environment: "Web dashboard",
      purpose: "Complete a purchase",
      body: "Context prose.",
      schema: 1,
      version: "1.0.0",
      updatedAt: "2024-01-01T00:00:00Z"
    });
    expect(bg.audience).toBe("Merchants");
  });

  it("accepts product package", () => {
    const pkg = productPackageSchema.parse({
      id: "checkout",
      name: "Checkout",
      background: {
        id: "checkout",
        name: "Checkout",
        audience: "Merchants",
        environment: "Web dashboard",
        purpose: "Complete a purchase",
        body: "",
        schema: 1,
        version: "1.0.0",
        updatedAt: "2024-01-01T00:00:00Z"
      },
      glossary: []
    });
    expect(pkg.writingGuide).toBeUndefined();
  });

  it("accepts upload inputs for fixed slots", () => {
    expect(uploadCompanyBaseInputSchema.parse({ content: "# Brand" }).content).toBe("# Brand");
    expect(
      uploadCompanyGlossaryInputSchema.parse({ content: "id,term", format: "csv" }).format
    ).toBe("csv");
    expect(
      createProductInputSchema.parse({
        id: "checkout",
        background: {
          id: "checkout",
          name: "Checkout",
          audience: "Merchants",
          environment: "Web",
          purpose: "Buy",
          body: "",
          schema: 1,
          version: "1.0.0",
          updatedAt: "2024-01-01T00:00:00Z"
        }
      }).id
    ).toBe("checkout");
  });
});
