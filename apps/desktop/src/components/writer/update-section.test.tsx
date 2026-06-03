import { describe, expect, it } from "vitest";
import { updateLabel } from "./update-section";

describe("updateLabel", () => {
  it("labels idle", () => {
    expect(updateLabel({ status: "idle" })).toBe("Up to date");
  });
  it("labels checking", () => {
    expect(updateLabel({ status: "checking" })).toBe("Checking for updates…");
  });
  it("labels available with version", () => {
    expect(updateLabel({ status: "available", version: "0.2.0" })).toBe("Update available: 0.2.0");
  });
  it("labels downloading with percent", () => {
    expect(updateLabel({ status: "downloading", percent: 42 })).toBe("Downloading… 42%");
  });
  it("labels downloaded", () => {
    expect(updateLabel({ status: "downloaded", version: "0.2.0" })).toBe("Update ready — restart to install");
  });
  it("labels error", () => {
    expect(updateLabel({ status: "error", message: "offline" })).toBe("Update error: offline");
  });
  it("labels up to date", () => {
    expect(updateLabel({ status: "not-available" })).toBe("You're up to date");
  });
});
