import { describe, expect, it } from "vitest";

import { detectCliAdapter } from "./create-cli-adapter";

describe("detectCliAdapter", () => {
  it("marks missing command as unavailable", async () => {
    const result = await detectCliAdapter({
      id: "missing-cli",
      displayName: "Missing",
      runtimeKind: "local",
      command: "writer-missing-cli-xyz",
      unavailableMessage: "Install missing CLI.",
      buildRunArgs: (prompt) => [prompt]
    });

    expect(result.adapter.available).toBe(false);
    expect(result.adapter.setupMessage).toContain("Install missing CLI");
  });
});
