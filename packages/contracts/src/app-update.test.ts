import { describe, expect, it } from "vitest";
import { parseAppUpdateState } from "./app-update";

describe("appUpdateState", () => {
  it("parses an available state with a version", () => {
    const s = parseAppUpdateState({ status: "available", version: "0.2.0" });
    expect(s).toEqual({ status: "available", version: "0.2.0" });
  });

  it("parses an available state with releaseNotes", () => {
    const s = parseAppUpdateState({ status: "available", version: "0.5.0", releaseNotes: "- Bug fixes" });
    expect(s).toEqual({ status: "available", version: "0.5.0", releaseNotes: "- Bug fixes" });
  });

  it("rejects an available state with empty releaseNotes", () => {
    expect(() => parseAppUpdateState({ status: "available", version: "0.5.0", releaseNotes: "" })).toThrow();
  });

  it("parses an available state without releaseNotes", () => {
    const s = parseAppUpdateState({ status: "available", version: "0.5.0" });
    expect(s).toEqual({ status: "available", version: "0.5.0" });
  });

  it("parses a downloading state with a percent", () => {
    expect(parseAppUpdateState({ status: "downloading", percent: 42 })).toEqual({
      status: "downloading",
      percent: 42
    });
  });

  it("parses a downloading state with bytes", () => {
    expect(parseAppUpdateState({ status: "downloading", percent: 42, transferredBytes: 160_000_000, totalBytes: 380_000_000 })).toEqual({
      status: "downloading",
      percent: 42,
      transferredBytes: 160_000_000,
      totalBytes: 380_000_000
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
