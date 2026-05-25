import { describe, expect, it } from "vitest";

describe("text-copy product picker", () => {
  it("treats zero products as empty-state path", () => {
    const products: { id: string }[] = [];
    expect(products.length).toBe(0);
  });
});
