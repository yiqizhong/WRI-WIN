import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The daemon suite exercises real I/O: adapter detection spawns child
    // processes (`where`/version probes) and MCP/file work hits disk. On
    // Windows under parallel-worker contention the cold-detection path can
    // exceed vitest's 5s default, so give these tests headroom while still
    // catching genuine hangs.
    testTimeout: 15000
  }
});
