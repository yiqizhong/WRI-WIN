import { describe, expect, it } from "vitest";
const { mapUpdaterEvent } = require("./auto-update-state.cjs");

describe("mapUpdaterEvent", () => {
  it("maps checking-for-update", () => {
    expect(mapUpdaterEvent("checking-for-update")).toEqual({ status: "checking" });
  });
  it("maps update-available to available with version", () => {
    expect(mapUpdaterEvent("update-available", { version: "0.2.0" })).toEqual({
      status: "available",
      version: "0.2.0"
    });
  });
  it("maps update-available with file size to totalBytes", () => {
    expect(mapUpdaterEvent("update-available", { version: "0.6.0", files: [{ size: 580_171_500 }] })).toEqual({
      status: "available",
      version: "0.6.0",
      totalBytes: 580_171_500,
    });
  });
  it("maps update-not-available", () => {
    expect(mapUpdaterEvent("update-not-available")).toEqual({ status: "not-available" });
  });
  it("maps download-progress to a clamped percent", () => {
    expect(mapUpdaterEvent("download-progress", { percent: 41.7 })).toEqual({
      status: "downloading",
      percent: 41
    });
  });
  it("maps download-progress with bytes when available", () => {
    expect(mapUpdaterEvent("download-progress", { percent: 42, transferred: 160_000_000, total: 380_000_000 })).toEqual({
      status: "downloading",
      percent: 42,
      transferredBytes: 160_000_000,
      totalBytes: 380_000_000
    });
  });
  it("maps update-downloaded to downloaded with version", () => {
    expect(mapUpdaterEvent("update-downloaded", { version: "0.2.0" })).toEqual({
      status: "downloaded",
      version: "0.2.0"
    });
  });
  it("maps error to error with a message", () => {
    expect(mapUpdaterEvent("error", new Error("offline"))).toEqual({
      status: "error",
      message: "offline"
    });
  });
});
