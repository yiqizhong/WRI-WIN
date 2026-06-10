import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PlatformStore } from "./store";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" })),
  access: vi.fn().mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" })),
}));

describe("store save", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("writes compact JSON (no pretty-print indentation)", async () => {
    const store = new PlatformStore({ dataDir: undefined });
    const spy = vi.spyOn(store as any, "writeFileImpl").mockResolvedValue(undefined);
    await (store as any).writeSnapshotToDisk();
    const payload = spy.mock.calls[0][1] as string;
    expect(payload).not.toMatch(/\n {2}"version"/); // no 2-space indented keys
  });

  it("coalesces a synchronous burst of save() into a single write", async () => {
    const store = new PlatformStore({ dataDir: undefined });
    const spy = vi.spyOn(store as any, "writeFileImpl").mockResolvedValue(undefined);
    void store.save(); void store.save(); void store.save();
    await vi.runAllTimersAsync();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
