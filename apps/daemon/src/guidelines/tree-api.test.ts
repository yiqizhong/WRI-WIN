import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverGuidelines } from "./discovery";
import { toGuidelinesTreeApi } from "./tree-api";

const testDir = join(process.cwd(), ".test-guidelines-tree-api");

describe("toGuidelinesTreeApi", () => {
  beforeEach(async () => {
    await mkdir(join(testDir, "products"), { recursive: true });
  });

  afterEach(async () => {
    await import("node:fs/promises").then((fs) => fs.rm(testDir, { recursive: true, force: true }));
  });

  it("includes basenames for filled product slots", async () => {
    const productDir = join(testDir, "products", "ddpm");
    await mkdir(productDir, { recursive: true });
    await writeFile(join(productDir, "background.md"), "---\nname: DDPM\n---\n");
    await writeFile(join(productDir, "glossary.md"), "# Glossary\n");
    await writeFile(join(productDir, "writing-guide.md"), "---\nid: wg\n---\n");

    const tree = await discoverGuidelines(testDir);
    const api = toGuidelinesTreeApi(tree);
    expect(api.products).toHaveLength(1);
    const item = api.products[0];
    expect(item?.backgroundFilename).toBe("background.md");
    expect(item?.glossaryFilename).toBe("glossary.md");
    expect(item?.writingGuideFilename).toBe("writing-guide.md");
  });

  it("prefers stored upload display names over on-disk basenames", async () => {
    const productDir = join(testDir, "products", "ddpm");
    await mkdir(productDir, { recursive: true });
    await writeFile(join(productDir, "background.md"), "---\nname: DDPM\n---\n");

    const tree = await discoverGuidelines(testDir);
    const api = toGuidelinesTreeApi(tree, {
      companyBase: "Acme Brand Voice v2.md",
      products: {
        ddpm: {
          background: "DDPM Product Context.md",
          glossary: "ddpm-terms.csv"
        }
      }
    });
    expect(api.companyBaseFilename).toBeUndefined();
    expect(api.products[0]?.backgroundFilename).toBe("DDPM Product Context.md");
    expect(api.products[0]?.hasGlossary).toBe(false);
    expect(api.products[0]?.glossaryFilename).toBeUndefined();
  });
});
