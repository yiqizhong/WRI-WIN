import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testDirRef = vi.hoisted(() => ({ path: "" }));

vi.mock("./discovery", () => ({
  guidelinesDir: () => testDirRef.path
}));

import {
  createProduct,
  deleteProduct,
  deleteProductFile,
  sanitizeProductId,
  writeCompanyBase,
  writeProductBackground
} from "./writer";

beforeEach(async () => {
  testDirRef.path = join(tmpdir(), `writer-guidelines-writer-${Date.now()}`);
  await mkdir(testDirRef.path, { recursive: true });
});

afterEach(async () => {
  await rm(testDirRef.path, { recursive: true, force: true });
});

describe("sanitizeProductId", () => {
  it("accepts kebab-case ids", () => {
    expect(sanitizeProductId("Checkout Flow")).toBe("checkout-flow");
  });

  it("rejects path traversal", () => {
    expect(sanitizeProductId("../evil")).toBeNull();
  });
});

describe("writer", () => {
  it("writes company-base.md", async () => {
    const result = await writeCompanyBase({ content: "# Base\n", overwrite: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const raw = await readFile(join(testDirRef.path, "company-base.md"), "utf8");
    expect(raw).toBe("# Base\n");
  });

  it("creates a product with background.md", async () => {
    const result = await createProduct({
      productId: "checkout",
      backgroundContent: "---\nid: checkout\nname: Checkout\naudience: a\nenvironment: b\npurpose: c\nschema: 1\nversion: \"1.0.0\"\nupdatedAt: \"2024-01-01T00:00:00Z\"\n---\n"
    });
    expect(result.ok).toBe(true);
    await expect(access(join(testDirRef.path, "products", "checkout", "background.md"))).resolves.toBeUndefined();
  });

  it("rejects duplicate product create", async () => {
    await createProduct({ productId: "checkout", backgroundContent: "body" });
    const second = await createProduct({ productId: "checkout", backgroundContent: "body2" });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe("conflict");
  });

  it("deletes optional product glossary file", async () => {
    const productDir = join(testDirRef.path, "products", "checkout");
    await mkdir(productDir, { recursive: true });
    await writeFile(join(productDir, "background.md"), "bg");
    await writeFile(join(productDir, "glossary.csv"), "id,term\n");

    const result = await deleteProductFile("checkout", "glossary");
    expect(result.ok).toBe(true);
    await expect(access(join(productDir, "glossary.csv"))).rejects.toThrow();
    await expect(access(join(productDir, "background.md"))).resolves.toBeUndefined();
  });

  it("deletes entire product directory", async () => {
    await writeProductBackground({
      productId: "checkout",
      content: "bg",
      overwrite: true
    });
    const result = await deleteProduct("checkout");
    expect(result.ok).toBe(true);
    await expect(access(join(testDirRef.path, "products", "checkout"))).rejects.toThrow();
  });
});
