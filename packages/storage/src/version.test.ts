import { describe, expect, it } from "vitest";

import { STORAGE_VERSION } from "./store";

describe("storage versioning", () => {
  it("uses a positive storage schema version", () => {
    expect(STORAGE_VERSION).toBeGreaterThan(0);
  });
});
