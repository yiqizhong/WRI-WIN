import { describe, it, expect, beforeEach } from "vitest";

const { approvePath, consumePath, isApproved, clearAll } = require("./write-guard.cjs");

describe("write-guard", () => {
  beforeEach(() => clearAll());

  it("rejects an un-approved path", () => {
    expect(consumePath("C:\\Users\\victim\\secret.txt")).toBe(false);
  });

  it("allows an approved path (non-consuming — repeated saves work)", () => {
    approvePath("C:\\Users\\user\\Downloads\\report.pdf");
    expect(consumePath("C:\\Users\\user\\Downloads\\report.pdf")).toBe(true);
    // Non-consuming: second call also succeeds (supports auto-save / Ctrl+S)
    expect(consumePath("C:\\Users\\user\\Downloads\\report.pdf")).toBe(true);
  });

  it("isApproved does not consume the path", () => {
    approvePath("C:\\Temp\\check.txt");
    expect(isApproved("C:\\Temp\\check.txt")).toBe(true);
    expect(isApproved("C:\\Temp\\check.txt")).toBe(true);
  });
});
