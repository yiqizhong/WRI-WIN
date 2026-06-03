import { describe, it, expect } from "vitest";
import { validateWhitelistName } from "./profile";

describe("validateWhitelistName", () => {
  it("accepts an exact name", () => {
    expect(validateWhitelistName("Yiqi")).toBe("Yiqi");
  });

  it("is case-insensitive", () => {
    expect(validateWhitelistName("yiqi")).toBe("Yiqi");
    expect(validateWhitelistName("YIQI")).toBe("Yiqi");
  });

  it("trims whitespace", () => {
    expect(validateWhitelistName("  Yiqi  ")).toBe("Yiqi");
  });

  it("returns null for unknown names", () => {
    expect(validateWhitelistName("Unknown")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(validateWhitelistName("")).toBeNull();
    expect(validateWhitelistName("   ")).toBeNull();
  });
});
