import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  AUDIT_ROUTE_TRANSITION_ENTER_MS,
  AUDIT_ROUTE_TRANSITION_EXIT_MS
} from "./audits-route-transition";

describe("audits route transition motion", () => {
  const css = readFileSync(
    new URL("../styles/writer-audits-route-transition.css", import.meta.url),
    "utf8"
  );

  it("uses asymmetric opacity timing (exit faster than enter)", () => {
    expect(AUDIT_ROUTE_TRANSITION_EXIT_MS).toBeLessThan(AUDIT_ROUTE_TRANSITION_ENTER_MS);
  });

  it("does not use scale or translate in route transition styles", () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

    expect(rules).not.toMatch(/\bscale\s*\(/);
    expect(rules).not.toMatch(/\btranslate[XY]?\s*\(/);
    expect(rules).not.toMatch(/\btransform\s*:/);
  });

  it("animates opacity only on content area (not subtitle/header)", () => {
    expect(css).toContain(".writer-page-content-inset");
    expect(css).toContain("writer-content-fade-in");
    expect(css).toContain("writer-content-fade-out");
    expect(css).toContain("animation:");
    expect(css).not.toContain(".writer-page-subheader");
  });
});
