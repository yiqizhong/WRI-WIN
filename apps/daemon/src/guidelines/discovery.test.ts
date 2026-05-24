import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverGuidelines, scaffoldIfAbsent } from "./discovery";
import { registerImporter } from "./importers/index";
import { MarkdownImporter } from "./importers/markdown-importer";

registerImporter(new MarkdownImporter());

const COMPANY_BASE_MD = `---
id: company-base
name: Company Base
layer: company-base
schema: 1
version: "1.0.0"
updatedAt: "2024-01-01T00:00:00Z"
---

Brand voice prose.

## Rules

- id: rule-a
  do: Be clear
  surfaces:
    - body
  severity: should
`;

const PRODUCT_BACKGROUND_MD = `---
id: checkout
name: Checkout
audience: Shoppers
environment: Web
purpose: Complete purchase
schema: 1
version: "1.0.0"
updatedAt: "2024-01-01T00:00:00Z"
---

Product context body.
`;

const PRODUCT_WRITING_GUIDE_MD = `---
id: checkout-guide
name: Checkout Writing Guide
layer: product-writing
productId: checkout
schema: 1
version: "1.0.0"
updatedAt: "2024-01-01T00:00:00Z"
---

## Rules

- id: rule-checkout
  do: Use short labels
  surfaces:
    - button
  severity: must
`;

let testDir: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `writer-discovery-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("discoverGuidelines", () => {
  it("scaffolds empty products dir without sample company file", async () => {
    await scaffoldIfAbsent(testDir);
    await expect(access(join(testDir, "products"))).resolves.toBeUndefined();
    await expect(access(join(testDir, "company-base.md"))).rejects.toThrow();
  });

  it("discovers only company-base when present", async () => {
    await writeFile(join(testDir, "company-base.md"), COMPANY_BASE_MD);

    const tree = await discoverGuidelines(testDir);
    expect(tree.companyBaseMissing).toBe(false);
    expect(tree.companyBase?.status).toBe("ok");
    if (tree.companyBase?.status === "ok") {
      expect(tree.companyBase.value.layer).toBe("company-base");
    }
    expect(tree.softwareWritingMissing).toBe(true);
    expect(tree.products).toHaveLength(0);
  });

  it("returns all-missing flags when directory is empty", async () => {
    const tree = await discoverGuidelines(testDir);
    expect(tree.companyBaseMissing).toBe(true);
    expect(tree.softwareWritingMissing).toBe(true);
    expect(tree.companyGlossaryMissing).toBe(true);
    expect(tree.products).toHaveLength(0);
  });

  it("discovers a complete product package", async () => {
    const productDir = join(testDir, "products", "checkout");
    await mkdir(productDir, { recursive: true });
    await writeFile(join(productDir, "background.md"), PRODUCT_BACKGROUND_MD);
    await writeFile(join(productDir, "writing-guide.md"), PRODUCT_WRITING_GUIDE_MD);
    await writeFile(
      join(productDir, "glossary.csv"),
      "id,term,status,forbidden,replacement,caseSensitive,reason\nterm-1,Checkout,active,,,false,\n"
    );

    const tree = await discoverGuidelines(testDir);
    expect(tree.products).toHaveLength(1);
    const pkg = tree.products[0];
    expect(pkg.status).toBe("ok");
    if (pkg.status !== "ok") return;
    expect(pkg.package.id).toBe("checkout");
    expect(pkg.package.background.audience).toBe("Shoppers");
    expect(pkg.package.glossary).toHaveLength(1);
    expect(pkg.package.writingGuide?.id).toBe("checkout-guide");
  });

  it("ignores product directories without background.md", async () => {
    const orphanDir = join(testDir, "products", "orphan");
    await mkdir(orphanDir, { recursive: true });
    await writeFile(
      join(orphanDir, "glossary.csv"),
      "id,term,status,forbidden,replacement,caseSensitive,reason\n"
    );

    const tree = await discoverGuidelines(testDir);
    expect(tree.products).toHaveLength(0);
  });

  it("marks background parse errors as product errors", async () => {
    const productDir = join(testDir, "products", "bad");
    await mkdir(productDir, { recursive: true });
    await writeFile(join(productDir, "background.md"), "---\nid: bad\n---\n");

    const tree = await discoverGuidelines(testDir);
    expect(tree.products).toHaveLength(1);
    expect(tree.products[0]?.status).toBe("error");
  });
});
