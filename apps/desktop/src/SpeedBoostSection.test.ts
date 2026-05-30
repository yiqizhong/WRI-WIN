import { describe, expect, it } from "vitest";

import { deriveSpeedBoostState } from "./SpeedBoostSection";

describe("deriveSpeedBoostState", () => {
  it("shows install button when not installed", () => {
    const view = deriveSpeedBoostState({ installed: false, enabled: false });
    expect(view.showInstall).toBe(true);
    expect(view.showToggle).toBe(false);
    expect(view.showBanner).toBe(false);
  });

  it("shows toggle when installed and enabled=false", () => {
    const view = deriveSpeedBoostState({ installed: true, enabled: false });
    expect(view.showInstall).toBe(false);
    expect(view.showToggle).toBe(true);
    expect(view.showBanner).toBe(false);
  });

  it("shows toggle when installed and enabled=true", () => {
    const view = deriveSpeedBoostState({ installed: true, enabled: true });
    expect(view.showInstall).toBe(false);
    expect(view.showToggle).toBe(true);
    expect(view.showBanner).toBe(false);
  });

  it("shows banner when lastError is set", () => {
    const view = deriveSpeedBoostState({ installed: true, enabled: false, lastError: "Insufficient VRAM" });
    expect(view.showBanner).toBe(true);
  });

  it("does not show banner when no lastError", () => {
    const view = deriveSpeedBoostState({ installed: true, enabled: true });
    expect(view.showBanner).toBe(false);
  });
});
