import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRunPoller } from "./create-run-poller";

describe("createRunPoller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("never overlaps: skips a tick while a poll is in-flight", async () => {
    let inFlight = 0, maxConcurrent = 0;
    const poll = vi.fn(async () => {
      inFlight++; maxConcurrent = Math.max(maxConcurrent, inFlight);
      await new Promise((r) => setTimeout(r, 1500)); // slower than the interval
      inFlight--;
    });
    const stop = createRunPoller(poll, 500);
    await vi.advanceTimersByTimeAsync(2000);
    expect(maxConcurrent).toBe(1);
    stop();
  });

  it("stops polling after stop() is called", async () => {
    const poll = vi.fn(async () => {});
    const stop = createRunPoller(poll, 500);
    await vi.advanceTimersByTimeAsync(500);
    const callsBefore = poll.mock.calls.length;
    stop();
    await vi.advanceTimersByTimeAsync(2000);
    expect(poll.mock.calls.length).toBe(callsBefore);
  });
});
