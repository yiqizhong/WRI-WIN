import { describe, expect, it } from "vitest";

import { buildSpawnArgs, isVramLoadFailure, resolveCtxSize, resolveKvType, shouldReuseProcess, stripTurn } from "./local-gemma-runtime";

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

describe("resolveCtxSize", () => {
  it("prefers a valid env override", () => {
    expect(resolveCtxSize("32768", 16384)).toBe(32768);
  });
  it("falls back to the option default when env is invalid or unset", () => {
    expect(resolveCtxSize(undefined, 16384)).toBe(16384);
    expect(resolveCtxSize("not-a-number", 16384)).toBe(16384);
    expect(resolveCtxSize("0", 16384)).toBe(16384);
  });
  it("falls back to 16384 when no option default is given", () => {
    expect(resolveCtxSize(undefined, undefined)).toBe(16384);
  });
});

describe("resolveKvType", () => {
  it("returns the env value when supported", () => {
    expect(resolveKvType("q8_0")).toBe("q8_0");
    expect(resolveKvType("q4_0")).toBe("q4_0");
    expect(resolveKvType("f16")).toBe("f16");
  });
  it("defaults to f16 when unset or unsupported", () => {
    expect(resolveKvType(undefined)).toBe("f16");
    expect(resolveKvType("bogus")).toBe("f16");
  });
});

describe("buildSpawnArgs", () => {
  const base = { modelPath: "/m.gguf", ctxSize: 16384, gpuLayers: "99", system: "" };

  it("carries the resolved ctx-size", () => {
    const args = buildSpawnArgs({ ...base, kvType: "f16" });
    const i = args.indexOf("--ctx-size");
    expect(args[i + 1]).toBe("16384");
  });
  it("omits cache-type flags for f16 (llama.cpp default)", () => {
    const args = buildSpawnArgs({ ...base, kvType: "f16" });
    expect(args).not.toContain("--cache-type-k");
  });
  it("adds cache-type flags for quantized KV", () => {
    const args = buildSpawnArgs({ ...base, kvType: "q8_0" });
    const k = args.indexOf("--cache-type-k");
    const v = args.indexOf("--cache-type-v");
    expect(args[k + 1]).toBe("q8_0");
    expect(args[v + 1]).toBe("q8_0");
  });
  it("appends -sys only when a system prompt is present", () => {
    expect(buildSpawnArgs({ ...base, kvType: "f16" })).not.toContain("-sys");
    expect(buildSpawnArgs({ ...base, kvType: "f16", system: "You are…" })).toContain("-sys");
  });
});

describe("shouldReuseProcess", () => {
  const ok = {
    resident: true, currentSystem: "S", system: "S",
    currentSessionId: "c1", sessionId: "c1", turnsHandled: 3, maxTurns: 50
  };
  it("reuses when everything matches", () => {
    expect(shouldReuseProcess(ok)).toBe(true);
  });
  it("restarts on a different conversation (new chat = zero context)", () => {
    expect(shouldReuseProcess({ ...ok, sessionId: "c2" })).toBe(false);
  });
  it("restarts on a system-prompt change", () => {
    expect(shouldReuseProcess({ ...ok, system: "OTHER" })).toBe(false);
  });
  it("restarts when the turn budget is exhausted", () => {
    expect(shouldReuseProcess({ ...ok, turnsHandled: 50 })).toBe(false);
  });
  it("restarts when no process is resident", () => {
    expect(shouldReuseProcess({ ...ok, resident: false })).toBe(false);
  });
});

describe("isVramLoadFailure", () => {
  it("detects common CUDA/alloc out-of-memory signatures", () => {
    expect(isVramLoadFailure("ggml_cuda: out of memory")).toBe(true);
    expect(isVramLoadFailure("failed to allocate CUDA0 buffer")).toBe(true);
    expect(isVramLoadFailure("cudaMalloc failed: out of memory")).toBe(true);
  });
  it("ignores unrelated errors", () => {
    expect(isVramLoadFailure("model file not found")).toBe(false);
    expect(isVramLoadFailure("")).toBe(false);
  });
});
