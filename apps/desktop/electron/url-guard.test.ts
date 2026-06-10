import { describe, it, expect } from "vitest";
import { isSafeExternalUrl } from "./url-guard.cjs";

describe("isSafeExternalUrl", () => {
  it("allows https/http/mailto", () => {
    expect(isSafeExternalUrl("https://figma.com/oauth?x=1")).toBe(true);
    expect(isSafeExternalUrl("http://127.0.0.1:5173/cb")).toBe(true);
    expect(isSafeExternalUrl("mailto:a@b.com")).toBe(true);
  });
  it("rejects file/UNC/javascript/custom/garbage", () => {
    expect(isSafeExternalUrl("file:///C:/Windows/system32/calc.exe")).toBe(false);
    expect(isSafeExternalUrl("file://attacker-host/share/evil.exe")).toBe(false);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("evilscheme://run")).toBe(false);
    expect(isSafeExternalUrl("not a url")).toBe(false);
    expect(isSafeExternalUrl("")).toBe(false);
    expect(isSafeExternalUrl(undefined)).toBe(false);
  });
});
