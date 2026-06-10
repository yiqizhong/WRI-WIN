import { describe, expect, it } from "vitest";

import { createEchoAdapter, buildEchoSpawn } from "./echo-adapter";
import { escapeCmdMetacharacters } from "./cli-runner";

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

  it("escapes cmd.exe metacharacters so a prompt cannot break out", () => {
    // Direct unit test of the escaper, host-independent: `& calc &` must be
    // neutralized so it cannot run as a separate command.
    const escaped = escapeCmdMetacharacters('" & calc & "');
    expect(escaped).not.toMatch(/\s&\scalc\s&/);
    expect(escaped).toContain("^&");
  });

  it("routes the Windows echo prompt through the cmd.exe escaper", () => {
    // buildEchoSpawn branches on the host OS. On Windows the prompt must be
    // escaped in-place; on non-Windows it takes the unescaped `/bin/echo`
    // pass-through branch, so assert each branch separately.
    const { args } = buildEchoSpawn('" & calc & "');
    if (process.platform === "win32") {
      expect(args.join(" ")).not.toMatch(/\s&\scalc\s&/);
      expect(args[2]).toContain("^&"); // escaped on the cmd.exe branch
    } else {
      expect(args).toEqual(['" & calc & "']); // pass-through on /bin/echo branch
    }
  });
});
