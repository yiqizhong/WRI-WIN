import { describe, expect, it } from "vitest";
import { parseAppUpdateState } from "./app-update";

describe("appUpdateState", () => {
  it("parses an available state with a version", () => {
    const s = parseAppUpdateState({ status: "available", version: "0.2.0" });
    expect(s).toEqual({ status: "available", version: "0.2.0" });
  });

  it("parses a downloading state with a percent", () => {
    expect(parseAppUpdateState({ status: "downloading", percent: 42 })).toEqual({
      status: "downloading",
      percent: 42
    });
  });

  it("parses a downloaded state with a version", () => {
    expect(parseAppUpdateState({ status: "downloaded", version: "0.2.0" })).toEqual({
      status: "downloaded",
      version: "0.2.0"
    });
  });

  it("parses an error state with a message", () => {
    expect(parseAppUpdateState({ status: "error", message: "offline" })).toEqual({
      status: "error",
      message: "offline"
    });
  });

  it("rejects an unknown status", () => {
    expect(() => parseAppUpdateState({ status: "bogus" })).toThrow();
  });
});
