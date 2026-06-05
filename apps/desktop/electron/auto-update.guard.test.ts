import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("auto-update invariant", () => {
  const src = readFileSync(join(__dirname, "auto-update.cjs"), "utf8");

  it("never writes to, deletes from, or resolves install-dir / user-data paths", () => {
    expect(src).not.toMatch(/getAppPath/);
    expect(src).not.toMatch(/\.writer/);
    expect(src).not.toMatch(/writeFile|rmSync|unlink|mkdir/);
  });

  // resourcesPath points at the read-only bundled app resources. Reading the
  // updater config (app-update.yml) from there is safe and intended; using it
  // for anything else risks touching the install dir. Allow only that read.
  it("uses resourcesPath solely to read the app-update.yml config", () => {
    const resourceLines = src.split(/\r?\n/).filter((line) => line.includes("resourcesPath"));
    expect(resourceLines.length).toBeGreaterThan(0);
    for (const line of resourceLines) {
      expect(line).toMatch(/app-update\.yml/);
    }
  });
});
