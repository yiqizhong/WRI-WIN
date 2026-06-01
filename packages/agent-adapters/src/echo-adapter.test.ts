import { describe, expect, it } from "vitest";

import { createEchoAdapter } from "./echo-adapter";

describe("echo-adapter", () => {
  it("detects as available on the current platform", async () => {
    // The dev echo adapter must work on whatever OS Writer runs on. Before the
    // fix it hardcodes the Unix-only `/bin/echo`, so detection reports
    // unavailable on Windows.
    const adapter = createEchoAdapter();
    const detection = await adapter.detect();

    expect(detection.adapter.available).toBe(true);
    expect(detection.adapter.executablePath).toBeTruthy();
  });

  it("echoes the prompt back as text on the current platform", async () => {
    const adapter = createEchoAdapter();
    const handle = await adapter.run({ sessionId: "s1", prompt: "hello-writer" });

    let text: string | undefined;
    for await (const event of handle.events) {
      if (event.type === "text") {
        text = (event.payload as { text: string }).text;
      }
    }

    expect(text).toContain("hello-writer");
  });
});
