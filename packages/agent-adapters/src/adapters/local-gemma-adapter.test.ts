import { EventEmitter } from "node:events";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";

// Module-level mock for node:child_process — hoisted by Vitest so it takes
// effect before any import resolves. We expose a writable `spawnImpl` ref
// so individual tests can swap in their own fake.
let spawnImpl: (...args: unknown[]) => unknown = () => { throw new Error("spawnImpl not set"); };

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawn: (...args: unknown[]) => spawnImpl(...args)
  };
});

import { extractResponse, splitCopywriterPrompt, parseNvidiaVramMib, detectNvidiaVram, resetGpuDeviceCache } from "./local-gemma-adapter";

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

describe("parseNvidiaVramMib", () => {
  it("extracts total MiB from a CUDA0 line", () => {
    const lines = [
      "CUDA0: NVIDIA GeForce RTX 4070 (12288 MiB, 12000 MiB free)"
    ];
    expect(parseNvidiaVramMib(lines)).toBe(12288);
  });

  it("returns null for CPU-only output (no CUDA line)", () => {
    expect(parseNvidiaVramMib(["CPU: Intel Core i9"])).toBeNull();
  });

  it("returns null for an empty device list", () => {
    expect(parseNvidiaVramMib([])).toBeNull();
  });

  it("returns null when the CUDA0 line has no MiB values", () => {
    expect(parseNvidiaVramMib(["CUDA0: NVIDIA GPU (unknown)"])).toBeNull();
  });

  it("extracts total MiB (first number) not free MiB (second number)", () => {
    const lines = ["CUDA0: NVIDIA RTX 3070 (8192 MiB, 7500 MiB free)"];
    expect(parseNvidiaVramMib(lines)).toBe(8192);
  });
});

describe("GPU device cache", () => {
  const fakeBinary = process.platform === "win32" ? "C:\\fake\\llama-cli.exe" : "/fake/llama-cli";

  beforeEach(() => {
    process.env["WRITER_LLAMA_CLI"] = fakeBinary;
  });

  afterEach(() => {
    resetGpuDeviceCache();
    delete process.env["WRITER_LLAMA_CLI"];
  });

  it("calls spawn --list-devices at most once across repeated detectNvidiaVram() calls", async () => {
    let listDevicesSpawnCount = 0;

    spawnImpl = (_bin: unknown, args: unknown) => {
      const proc = new EventEmitter();
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      (proc as unknown as Record<string, unknown>).stdout = stdout;
      (proc as unknown as Record<string, unknown>).stderr = stderr;

      if (Array.isArray(args) && args.includes("--list-devices")) {
        listDevicesSpawnCount++;
        setImmediate(() => {
          stdout.emit("data", Buffer.from("CUDA0: NVIDIA RTX 4070 (12288 MiB, 11000 MiB free)\n"));
          proc.emit("close", 0);
        });
      } else {
        setImmediate(() => proc.emit("close", 0));
      }

      return proc;
    };

    // First call — cache is cold, should spawn llama-cli --list-devices once.
    await detectNvidiaVram();
    // Second call — cachedGpuDevices is populated; no new spawn expected.
    await detectNvidiaVram();

    expect(listDevicesSpawnCount).toBe(1);
  });
});
