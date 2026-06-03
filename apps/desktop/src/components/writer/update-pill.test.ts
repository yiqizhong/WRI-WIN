import { describe, expect, it } from "vitest";
import { pillLabel, pillVariant } from "./update-pill";
import type { AppUpdateState } from "@writer/contracts";

describe("pillLabel", () => {
  it("returns null for idle", () => {
    expect(pillLabel({ status: "idle" })).toBeNull();
  });
  it("returns null for checking", () => {
    expect(pillLabel({ status: "checking" })).toBeNull();
  });
  it("returns null for not-available", () => {
    expect(pillLabel({ status: "not-available" })).toBeNull();
  });
  it("returns Upgrade for available", () => {
    expect(pillLabel({ status: "available", version: "0.3.0" })).toBe("Upgrade");
  });
  it("returns Downloading… for downloading", () => {
    expect(pillLabel({ status: "downloading", percent: 50 })).toBe("Downloading…");
  });
  it("returns Update ready for downloaded", () => {
    expect(pillLabel({ status: "downloaded", version: "0.3.0" })).toBe("Update ready");
  });
  it("returns Update failed for error", () => {
    expect(pillLabel({ status: "error", message: "offline" })).toBe("Update failed");
  });
});

describe("pillVariant", () => {
  it("returns null for idle", () => expect(pillVariant({ status: "idle" })).toBeNull());
  it("returns blue for available", () => expect(pillVariant({ status: "available", version: "0.3.0" })).toBe("blue"));
  it("returns gray for downloading", () => expect(pillVariant({ status: "downloading", percent: 0 })).toBe("gray"));
  it("returns green for downloaded", () => expect(pillVariant({ status: "downloaded", version: "0.3.0" })).toBe("green"));
  it("returns warning for error", () => expect(pillVariant({ status: "error", message: "x" })).toBe("warning"));
});
