import { describe, expect, it } from "vitest";

import { extractResponse, splitCopywriterPrompt } from "./local-gemma-adapter";

describe("splitCopywriterPrompt", () => {
  it("splits system and user on the --- separator", () => {
    const full = "SYSTEM RULES\n\n---\n\nCopy to rewrite:\nSubmit the form.";
    expect(splitCopywriterPrompt(full)).toEqual({
      system: "SYSTEM RULES",
      user: "Copy to rewrite:\nSubmit the form."
    });
  });

  it("treats the whole string as user text when no separator", () => {
    expect(splitCopywriterPrompt("just user text")).toEqual({
      system: "",
      user: "just user text"
    });
  });
});

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

  // Real conversation-mode shape from the thinking Gemma build: the user text is
  // echoed (multi-line), a long [Start thinking]...[End thinking] block follows,
  // then the answer, then the footer. The [End thinking] boundary wins.
  it("takes only the answer after [End thinking] in conversation mode", () => {
    const user = "Copy to rewrite:\nSubmit the form.\n\nRespond with only the rewritten text.";
    const raw = [
      "> Copy to rewrite:",
      "Submit the form.",
      "",
      "Respond with only the rewritten text.",
      "",
      "[Start thinking]",
      "1. Analyze the request. The user wants a friendlier rewrite.",
      "2. Consider options like Submit, Send, Finish.",
      "[End thinking]",
      "",
      "Submit",
      "",
      "[ Prompt: 430.3 t/s | Generation: 57.1 t/s ]",
      "",
      "Exiting..."
    ].join("\r\n");
    expect(extractResponse(raw, user)).toBe("Submit");
  });

  it("strips ANSI color codes around the prompt line", () => {
    const raw = `\x1b[32m> ${prompt}\x1b[0m\n\nClean answer.\n\nExiting...`;
    expect(extractResponse(raw, prompt)).toBe("Clean answer.");
  });

  it("returns trimmed response even when no banner/echo is present", () => {
    expect(extractResponse("  Just the answer.  ", prompt)).toBe("Just the answer.");
  });
});
