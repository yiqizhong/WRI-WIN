import { describe, expect, it } from "vitest";

import { stripTurn } from "./local-gemma-runtime";

// Pure parsing of a single resident-mode turn slice. The stateful process
// lifecycle (spawn reuse, idle eviction, crash recovery, serialization) is
// verified end-to-end against the live daemon — see
// openspec/changes/local-gemma-resident-process/verify.md — because faithfully
// mocking llama-cli's stdin/stdout turn protocol in unit tests proved more
// brittle than it was worth.
describe("stripTurn", () => {
  it("strips a leading ready prompt and CRLF", () => {
    expect(stripTurn("> \r\nFill out the form.\r\n")).toBe("Fill out the form.");
  });

  it("strips ANSI color codes around the ready prompt", () => {
    expect(stripTurn("\x1b[32m> \x1b[0m\nClean answer.")).toBe("Clean answer.");
  });

  it("takes text after [End thinking] if a thinking block leaks through", () => {
    expect(stripTurn("> \n[Start thinking]\nreasoning\n[End thinking]\nThe answer.")).toBe(
      "The answer."
    );
  });

  it("drops a stray unclosed thinking block", () => {
    expect(stripTurn("> \nGood answer.\n[Start thinking]\nleaked")).toBe("Good answer.");
  });

  it("returns trimmed plain text when no markers are present", () => {
    expect(stripTurn("  Just the answer.  ")).toBe("Just the answer.");
  });
});
