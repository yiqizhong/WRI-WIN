import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { listDirectory } from "./filesystem";

describe("daemon filesystem", () => {
  it("lists files and directories for a folder", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "writer-fs-"));
    await writeFile(path.join(dir, "notes.txt"), "hello");

    const listing = await listDirectory(dir);

    expect(listing.path).toBe(dir);
    expect(listing.entries.some((entry) => entry.name === "notes.txt" && entry.type === "file")).toBe(
      true
    );
  });
});
