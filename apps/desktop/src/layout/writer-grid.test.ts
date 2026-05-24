import { describe, expect, it } from "vitest";

import { WRITER_MINI_UNIT_PX, WRITER_PRODUCT_MAX_WIDTH } from "./writer-grid";

describe("writer-grid constants", () => {
  it("exposes layout constants for product chrome", () => {
    expect(WRITER_MINI_UNIT_PX).toBe(8);
    expect(WRITER_PRODUCT_MAX_WIDTH).toBeTruthy();
  });
});
