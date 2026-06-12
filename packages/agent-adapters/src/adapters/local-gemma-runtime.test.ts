import { describe, expect, it } from "vitest";

import { buildSpawnArgs, isDraftLoadFailure, isVramLoadFailure, parseTurnMetrics, resolveCtxSize, resolveDraftModelPath, resolveFlashAttn, resolveKvType, resolveSpecType, resolveUbatch, shouldReuseProcess, stripTurn } from "./local-gemma-runtime";

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
  const base = { modelPath: "/m.gguf", ctxSize: 16384, gpuLayers: "99", flashAttn: "on" as const, ubatch: 1024, system: "", draftModelPath: null as string | null, specType: "ngram-simple" as const, reasoning: false };

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
    currentSessionId: "c1", sessionId: "c1", turnsHandled: 3, maxTurns: 50,
    currentReasoning: false, reasoning: false
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
  it("restarts when reasoning mode changes", () => {
    expect(shouldReuseProcess({ ...ok, reasoning: true })).toBe(false);
  });
});

describe("resolveFlashAttn", () => {
  it("defaults to on", () => {
    expect(resolveFlashAttn(undefined)).toBe("on");
  });
  it("accepts on/off/auto", () => {
    expect(resolveFlashAttn("off")).toBe("off");
    expect(resolveFlashAttn("auto")).toBe("auto");
    expect(resolveFlashAttn("on")).toBe("on");
  });
  it("falls back to on for unrecognized values", () => {
    expect(resolveFlashAttn("yes")).toBe("on");
  });
});

describe("resolveUbatch", () => {
  it("defaults to 1024", () => {
    expect(resolveUbatch(undefined)).toBe(1024);
  });
  it("accepts a valid positive integer", () => {
    expect(resolveUbatch("2048")).toBe(2048);
  });
  it("falls back to 1024 for invalid values", () => {
    expect(resolveUbatch("0")).toBe(1024);
    expect(resolveUbatch("nope")).toBe(1024);
  });
});

describe("buildSpawnArgs flash-attn + ubatch", () => {
  const base = { modelPath: "/m.gguf", ctxSize: 16384, gpuLayers: "99", kvType: "f16" as const, system: "", draftModelPath: null as string | null, specType: "ngram-simple" as const, reasoning: false };

  it("carries -fa and -ub with defaults", () => {
    const args = buildSpawnArgs({ ...base, flashAttn: "on", ubatch: 1024 });
    expect(args[args.indexOf("-fa") + 1]).toBe("on");
    expect(args[args.indexOf("-ub") + 1]).toBe("1024");
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

describe("parseTurnMetrics", () => {
  it("extracts prompt and generation tokens/sec from a footer", () => {
    const footer = "[ Prompt: 210.34 t/s | Predicted: 52.10 t/s ]";
    expect(parseTurnMetrics(footer)).toEqual({
      promptTokensPerSec: 210.34,
      evalTokensPerSec: 52.1,
      draftAccepted: null,
      draftProposed: null
    });
  });
  it("tolerates eval/generation wording and CRLF", () => {
    const footer = "\r\n[ Prompt: 180 t/s | eval: 49.5 t/s ]\r\n";
    expect(parseTurnMetrics(footer)).toEqual({
      promptTokensPerSec: 180,
      evalTokensPerSec: 49.5,
      draftAccepted: null,
      draftProposed: null
    });
  });
  it("returns nulls when the footer is unrecognized", () => {
    expect(parseTurnMetrics("no numbers here")).toEqual({
      promptTokensPerSec: null,
      evalTokensPerSec: null,
      draftAccepted: null,
      draftProposed: null
    });
  });
  it("tolerates generation and gen label variants", () => {
    expect(parseTurnMetrics("[ Prompt: 100 t/s | generation: 45.5 t/s ]")).toEqual({
      promptTokensPerSec: 100,
      evalTokensPerSec: 45.5,
      draftAccepted: null,
      draftProposed: null
    });
    expect(parseTurnMetrics("[ Prompt: 100 t/s | gen: 45.5 t/s ]")).toEqual({
      promptTokensPerSec: 100,
      evalTokensPerSec: 45.5,
      draftAccepted: null,
      draftProposed: null
    });
  });
  it("extracts draft acceptance when present", () => {
    const footer = "[ Prompt: 200 t/s | eval: 60 t/s | draft: 3.2/4.0 accepted ]";
    expect(parseTurnMetrics(footer)).toEqual({
      promptTokensPerSec: 200,
      evalTokensPerSec: 60,
      draftAccepted: 3.2,
      draftProposed: 4.0
    });
  });
  it("draftAccepted/draftProposed are null when absent", () => {
    const footer = "[ Prompt: 200 t/s | eval: 60 t/s ]";
    expect(parseTurnMetrics(footer)).toEqual({
      promptTokensPerSec: 200,
      evalTokensPerSec: 60,
      draftAccepted: null,
      draftProposed: null
    });
  });
});

describe("resolveDraftModelPath", () => {
  it("returns env path when set, regardless of settings", () => {
    expect(resolveDraftModelPath("/env.gguf", { enabled: false, path: "/s.gguf" })).toBe("/env.gguf");
    expect(resolveDraftModelPath("/env.gguf", { enabled: true,  path: "/s.gguf" })).toBe("/env.gguf");
  });
  it("returns settings path when env unset, toggle on, path present", () => {
    expect(resolveDraftModelPath(undefined, { enabled: true, path: "/s.gguf" })).toBe("/s.gguf");
  });
  it("returns null when toggle off", () => {
    expect(resolveDraftModelPath(undefined, { enabled: false, path: "/s.gguf" })).toBeNull();
  });
  it("returns null when toggle on but path missing", () => {
    expect(resolveDraftModelPath(undefined, { enabled: true, path: null })).toBeNull();
  });
  it("returns null when both undefined", () => {
    expect(resolveDraftModelPath(undefined, { enabled: false, path: null })).toBeNull();
  });
});

describe("buildSpawnArgs draft model", () => {
  const base = {
    modelPath: "/m.gguf", ctxSize: 16384, gpuLayers: "99", kvType: "f16" as const,
    flashAttn: "on" as const, ubatch: 1024, system: "", draftModelPath: null as string | null,
    specType: "ngram-simple" as const, reasoning: false
  };
  it("appends --model-draft when set", () => {
    const args = buildSpawnArgs({ ...base, draftModelPath: "/d.gguf" });
    expect(args[args.indexOf("--model-draft") + 1]).toBe("/d.gguf");
  });
  it("omits --model-draft when null", () => {
    const args = buildSpawnArgs({ ...base, draftModelPath: null });
    expect(args).not.toContain("--model-draft");
  });
});

describe("isDraftLoadFailure", () => {
  it("matches a llama-cli draft VRAM error line", () => {
    const stderr = "ggml_cuda_init: failed to allocate VRAM for --model-draft (gemma-4-E4B-draft-Q4_0.gguf)\n";
    expect(isDraftLoadFailure(stderr)).toBe(true);
  });
  it("tolerates CRLF", () => {
    const stderr = "ggml_cuda: out of memory allocating draft model\r\n";
    expect(isDraftLoadFailure(stderr)).toBe(true);
  });
  it("returns false when only the main model failed (no draft mention)", () => {
    expect(isDraftLoadFailure("out of memory loading main model")).toBe(false);
  });
  it("returns false on unrelated stderr", () => {
    expect(isDraftLoadFailure("model loaded successfully")).toBe(false);
  });
});

describe("resolveSpecType", () => {
  it("defaults to none when unset", () => {
    expect(resolveSpecType(undefined)).toBe("none");
  });
  it("accepts valid spec types", () => {
    expect(resolveSpecType("none")).toBe("none");
    expect(resolveSpecType("ngram-simple")).toBe("ngram-simple");
    expect(resolveSpecType("ngram-mod")).toBe("ngram-mod");
    expect(resolveSpecType("ngram-map-k")).toBe("ngram-map-k");
    expect(resolveSpecType("ngram-map-k4v")).toBe("ngram-map-k4v");
    expect(resolveSpecType("ngram-cache")).toBe("ngram-cache");
  });
  it("falls back to none for unrecognized values", () => {
    expect(resolveSpecType("invalid")).toBe("none");
    expect(resolveSpecType("")).toBe("none");
  });
});

describe("buildSpawnArgs specType", () => {
  const base = {
    modelPath: "/m.gguf", ctxSize: 16384, gpuLayers: "99", kvType: "f16" as const,
    flashAttn: "on" as const, ubatch: 1024, system: "", draftModelPath: null as string | null,
    specType: "ngram-simple" as const, reasoning: false
  };
  it("appends --spec-type when not none", () => {
    const args = buildSpawnArgs(base);
    expect(args[args.indexOf("--spec-type") + 1]).toBe("ngram-simple");
  });
  it("omits --spec-type when none", () => {
    const args = buildSpawnArgs({ ...base, specType: "none" });
    expect(args).not.toContain("--spec-type");
  });
  it("passes ngram-mod correctly", () => {
    const args = buildSpawnArgs({ ...base, specType: "ngram-mod" });
    expect(args[args.indexOf("--spec-type") + 1]).toBe("ngram-mod");
  });
});
