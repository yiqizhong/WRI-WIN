import { describe, expect, it } from "vitest";

import {
  WRITER_GRID_BREAKPOINTS,
  WRITER_GRID_FULL,
  WRITER_GRID_HALF,
  WRITER_GRID_QUARTER,
  WRITER_GRID_THIRD_CENTER,
  WRITER_GRID_THIRD_LEADING,
  WRITER_GRID_THIRD_TRAILING,
  WRITER_MINI_UNIT_PX
} from "./writer-grid";

describe("writer-grid constants", () => {
  it("matches IBM 2x grid mini unit and lg column count", () => {
    expect(WRITER_MINI_UNIT_PX).toBe(8);
    expect(WRITER_GRID_BREAKPOINTS.lg.columns).toBe(16);
    expect(WRITER_GRID_BREAKPOINTS.lg.padding).toBe(16);
  });

  it("uses powers-of-two divisions at lg", () => {
    expect(WRITER_GRID_FULL.lg).toBe(16);
    expect(WRITER_GRID_HALF.lg).toBe(8);
    expect(WRITER_GRID_QUARTER.lg).toBe(4);
    expect(WRITER_GRID_HALF.lg + WRITER_GRID_HALF.lg).toBe(WRITER_GRID_FULL.lg);
    expect(WRITER_GRID_QUARTER.lg * 4).toBe(WRITER_GRID_FULL.lg);
  });

  it("supports three-column (5+6+5) odd configuration at lg", () => {
    expect(WRITER_GRID_THIRD_LEADING.lg + WRITER_GRID_THIRD_CENTER.lg + WRITER_GRID_THIRD_TRAILING.lg).toBe(
      WRITER_GRID_FULL.lg
    );
  });
});
