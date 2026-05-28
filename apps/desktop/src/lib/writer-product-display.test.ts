import { describe, expect, it } from "vitest";

import {
  formatAuditDetailPageTitle,
  formatProductDisplayName,
  GENERAL_PURPOSE_PRODUCT_LABEL
} from "./writer-product-display";

describe("formatProductDisplayName", () => {
  it("uppercases product folder id", () => {
    expect(formatProductDisplayName("ddpm")).toBe("DDPM");
  });
});

describe("formatAuditDetailPageTitle", () => {
  it("uses general purpose label when product is missing", () => {
    expect(formatAuditDetailPageTitle({ featureName: "Checkout" })).toBe(
      `${GENERAL_PURPOSE_PRODUCT_LABEL} · Checkout`
    );
  });

  it("uses product display name when product is set", () => {
    expect(formatAuditDetailPageTitle({ productId: "ddpm", featureName: "Checkout" })).toBe(
      "DDPM · Checkout"
    );
  });

  it("falls back when session is null", () => {
    expect(formatAuditDetailPageTitle(null)).toBe("Audit");
  });
});
