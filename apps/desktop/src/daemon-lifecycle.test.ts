import { describe, expect, it } from "vitest";

import { isDaemonHealthCompatible, shouldRestartDaemon } from "./daemon-lifecycle";

const expected = { version: "0.1.0", apiRevision: "3" };

describe("daemon lifecycle", () => {
  it("accepts matching health", () => {
    expect(isDaemonHealthCompatible({ version: "0.1.0", apiRevision: "3" }, expected)).toBe(true);
    expect(shouldRestartDaemon({ version: "0.1.0", apiRevision: "3" }, expected)).toBe(false);
  });

  it("rejects missing health", () => {
    expect(isDaemonHealthCompatible(null, expected)).toBe(false);
    expect(shouldRestartDaemon(null, expected)).toBe(false);
  });

  it("restarts when api revision is stale", () => {
    expect(isDaemonHealthCompatible({ version: "0.1.0", apiRevision: "1" }, expected)).toBe(false);
    expect(shouldRestartDaemon({ version: "0.1.0", apiRevision: "1" }, expected)).toBe(true);
  });

  it("restarts when app version differs", () => {
    expect(shouldRestartDaemon({ version: "0.0.9", apiRevision: "3" }, expected)).toBe(true);
  });
});
