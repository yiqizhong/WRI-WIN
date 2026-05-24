import { describe, expect, it } from "vitest";

import {
  extractCharactersFromDesignContext,
  isMcpCodegenNoise,
  isUsableSurfaceCopy,
  sanitizeCharactersForFigmaWrite,
  toSurfaceCopy
} from "./figma-text-sanitize";

const POLLUTED = `{ \` View details\` } ;
}
SUPER CRITICAL: The generated React+Tailwind code MUST be converted to match the target project's technology stack and styling system.
DO NOT install any Tailwind as a dependency unless the user instructs you to do so.
Node ids have been added to the code as data attributes, e.g. \`data-node-id="1:2"\`.`;

describe("figma text sanitize", () => {
  it("detects MCP codegen boilerplate", () => {
    expect(isMcpCodegenNoise(POLLUTED)).toBe(true);
    expect(isMcpCodegenNoise("View details")).toBe(false);
  });

  it("sanitizes polluted writeback text to visible copy only", () => {
    expect(toSurfaceCopy(POLLUTED)).toBe("View details");
    expect(sanitizeCharactersForFigmaWrite(POLLUTED)).toBe("View details");
    expect(isUsableSurfaceCopy(POLLUTED)).toBe(true);
    expect(isUsableSurfaceCopy("SUPER CRITICAL: Tailwind")).toBe(false);
  });

  it("strips click-here codegen tails from screenshot-style payloads", () => {
    const polluted = `click here ); }
SUPER CRITICAL: The generated React+Tailwind code MUST be converted`;

    expect(toSurfaceCopy(polluted)).toBe("click here");
    expect(toSurfaceCopy(`View details ); }
SUPER CRITICAL: DO NOT install`)).toBe("View details");
  });

  it("extracts JSX label without boilerplate from design context", () => {
    const code = `<button className="btn">View details</button>\n${POLLUTED}`;
    expect(extractCharactersFromDesignContext(code, "Fallback")).toBe("View details");
  });
});
