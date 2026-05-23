import { describe, expect, it } from "vitest";

import { parseCursorAgentStreamLine } from "./stream-json";

describe("parseCursorAgentStreamLine", () => {
  it("extracts partial assistant deltas", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: "Hello" }] },
      timestamp_ms: 1
    });

    expect(parseCursorAgentStreamLine(line)).toEqual({ kind: "delta", text: "Hello" });
  });

  it("extracts final result text", () => {
    const line = JSON.stringify({
      type: "result",
      subtype: "success",
      result: "Hello world"
    });

    expect(parseCursorAgentStreamLine(line)).toEqual({ kind: "final", text: "Hello world" });
  });

  it("ignores non-delta assistant messages without timestamp", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: "Hello world" }] }
    });

    expect(parseCursorAgentStreamLine(line)).toBeNull();
  });
});
