import { describe, expect, it } from "vitest";

import { GEMMA_4_E4B_MANIFEST } from "./local-model-manifest";

describe("GEMMA_4_E4B_MANIFEST", () => {
  it("declares a 16K default context window", () => {
    expect(GEMMA_4_E4B_MANIFEST.defaultContext).toBe(16384);
  });

  it("keeps the default within the model's max context", () => {
    expect(GEMMA_4_E4B_MANIFEST.defaultContext).toBeLessThanOrEqual(
      GEMMA_4_E4B_MANIFEST.modelMaxContext
    );
  });
});
