import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("auto-update invariant", () => {
  it("never references install-dir or user-data write paths", () => {
    const src = readFileSync(join(__dirname, "auto-update.cjs"), "utf8");
    expect(src).not.toMatch(/getAppPath/);
    expect(src).not.toMatch(/resourcesPath/);
    expect(src).not.toMatch(/\.writer/);
    expect(src).not.toMatch(/writeFile|rmSync|unlink|mkdir/);
  });
});
