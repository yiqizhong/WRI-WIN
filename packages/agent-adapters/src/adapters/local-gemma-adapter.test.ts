import { describe, expect, it } from "vitest";

import { extractResponse } from "./local-gemma-adapter";

describe("extractResponse", () => {
  const prompt = "Rewrite to be friendlier: Submit the form.";

  // Real llama-cli (build b9384) stdout shape with CRLF endings: banner, prompt
  // echo, response, stats footer. The previous parser matched "\n> <prompt>\n\n"
  // literally and never matched under CRLF, returning empty ("Agent returned
  // empty rewrite").
  const sampleCrlf = [
    "Loading model... ",
    "build      : b9384-48e7078ee",
    "model      : gemma-4-E4B-it-Q8_0.gguf",
    "",
    "available commands:",
    "  /exit or Ctrl+C     stop or exit",
    "",
    `> ${prompt}`,
    "",
    "Please submit the form when you're ready.",
    "",
    "[ Prompt: 134.4 t/s | Generation: 58.5 t/s ]",
    "",
    "Exiting..."
  ].join("\r\n");

  it("extracts the response from CRLF output, stripping banner and footer", () => {
    const out = extractResponse(sampleCrlf, prompt);
    expect(out).toBe("Please submit the form when you're ready.");
    expect(out).not.toContain("available commands");
    expect(out).not.toContain("Prompt:");
  });

  it("strips a [Start thinking]...[End thinking] reasoning block", () => {
    const raw = [
      `> ${prompt}`,
      "",
      "[Start thinking]",
      "The user wants a friendlier tone. Consider warmth.",
      "[End thinking]",
      "Please go ahead and submit the form.",
      "[ Prompt: 100 t/s ]"
    ].join("\n");
    const out = extractResponse(raw, prompt);
    expect(out).toBe("Please go ahead and submit the form.");
    expect(out).not.toContain("thinking");
  });

  it("handles LF-only output", () => {
    const raw = `> ${prompt}\n\nFriendlier text here.\n\nExiting...`;
    expect(extractResponse(raw, prompt)).toBe("Friendlier text here.");
  });

  it("returns trimmed response even when no banner/echo is present", () => {
    expect(extractResponse("  Just the answer.  ", prompt)).toBe("Just the answer.");
  });
});
