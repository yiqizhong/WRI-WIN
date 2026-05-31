import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname } from "node:path";

// Keeps a single `llama-cli` conversation process resident in VRAM and routes
// each agent run to it as a "turn" over stdin — avoiding the ~4-5s model reload
// that a fresh process per message incurs. See
// openspec/changes/local-gemma-resident-process/ for the design.
//
// Protocol (llama-cli -cnv --simple-io, this build b9384):
//   - On start, after the model loads, it prints a ready prompt line "> ".
//   - We write "<user text>\n" to stdin to run a turn.
//   - It streams the response, then a per-turn footer "[ Prompt: ... t/s ]",
//     then the next ready prompt "> ".
//   - The turn's response is the text between the ready prompt and the footer.

export type DraftSettings = { enabled: boolean; path: string | null };

export type LocalGemmaRuntimeOptions = {
  binary: string;
  modelPath: string;
  gpuLayers: string;
  contextSize?: number;
  draftSettings?: DraftSettings;
};

const READY_PROMPT = /^> ?$/m;
const TURN_FOOTER = /\n?\[ Prompt:.*?\]/;

function idleMs(): number {
  const raw = process.env["WRITER_LOCAL_IDLE_MS"];
  if (raw === undefined) return 300_000;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 300_000;
}

function turnTimeoutMs(): number {
  const raw = process.env["WRITER_LOCAL_TURN_TIMEOUT_MS"];
  if (raw === undefined) return 120_000;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 120_000;
}

export type KvCacheType = "f16" | "q8_0" | "q4_0";

const DEFAULT_CTX_SIZE = 16384;

export function resolveCtxSize(envValue: string | undefined, optionDefault: number | undefined): number {
  const fromEnv = Number(envValue);
  if (Number.isInteger(fromEnv) && fromEnv > 0) return fromEnv;
  if (optionDefault && Number.isInteger(optionDefault) && optionDefault > 0) return optionDefault;
  return DEFAULT_CTX_SIZE;
}

export function resolveKvType(envValue: string | undefined): KvCacheType {
  return envValue === "q8_0" || envValue === "q4_0" || envValue === "f16" ? envValue : "f16";
}

export type FlashAttn = "on" | "off" | "auto";

const DEFAULT_UBATCH = 1024;

/** env value > default 'on'. Only on/off/auto are valid. */
export function resolveFlashAttn(envValue: string | undefined): FlashAttn {
  return envValue === "on" || envValue === "off" || envValue === "auto" ? envValue : "on";
}

/** env value > default 1024. Only finite positive integers win. */
export function resolveUbatch(envValue: string | undefined): number {
  const n = Number(envValue);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_UBATCH;
}

const VALID_SPEC_TYPES = ["none", "ngram-simple", "ngram-mod", "ngram-map-k", "ngram-map-k4v", "ngram-cache"] as const;
export type SpecType = (typeof VALID_SPEC_TYPES)[number];

/**
 * env value > default 'ngram-simple'.
 * 'none' disables speculative decoding entirely.
 * Only valid spec types are accepted; anything else falls back to the default.
 */
export function resolveSpecType(envValue: string | undefined): SpecType {
  if (envValue && (VALID_SPEC_TYPES as readonly string[]).includes(envValue)) {
    return envValue as SpecType;
  }
  return "ngram-simple";
}

/**
 * Precedence: env override > storage settings (enabled + path) > null.
 * Pure: no I/O.
 */
export function resolveDraftModelPath(
  envValue: string | undefined,
  settings: DraftSettings
): string | null {
  if (envValue && envValue.length > 0) return envValue;
  if (settings.enabled && settings.path) return settings.path;
  return null;
}

export function buildSpawnArgs(input: {
  modelPath: string;
  ctxSize: number;
  gpuLayers: string;
  kvType: KvCacheType;
  flashAttn: FlashAttn;
  ubatch: number;
  draftModelPath: string | null;
  specType: SpecType;
  system: string;
}): string[] {
  const args = [
    "--model", input.modelPath,
    "--ctx-size", String(input.ctxSize),
    "-ngl", input.gpuLayers,
    "-cnv",
    "--simple-io",
    "--reasoning", "off",
    "-fa", input.flashAttn,
    "-ub", String(input.ubatch),
    "-n", "512",
    "--log-disable"
  ];
  if (input.kvType !== "f16") {
    args.push("--cache-type-k", input.kvType, "--cache-type-v", input.kvType);
  }
  if (input.draftModelPath) {
    args.push("--model-draft", input.draftModelPath);
  }
  if (input.specType !== "none") {
    args.push("--spec-type", input.specType);
  }
  if (input.system) {
    args.push("-sys", input.system);
  }
  return args;
}

export function shouldReuseProcess(input: {
  resident: boolean;
  currentSystem: string | null;
  system: string;
  currentSessionId: string | null;
  sessionId: string;
  turnsHandled: number;
  maxTurns: number;
}): boolean {
  return (
    input.resident &&
    input.currentSystem === input.system &&
    input.currentSessionId === input.sessionId &&
    input.turnsHandled < input.maxTurns
  );
}

export function isVramLoadFailure(stderr: string): boolean {
  return /out of memory|failed to allocate|cudamalloc|cuda error|vram/i.test(stderr);
}

/**
 * Match stderr indicating draft model specifically failed to load (VRAM/alloc error
 * mentioning --model-draft or draft model). Conservative — requires BOTH a VRAM
 * marker AND a draft-model mention.
 */
export function isDraftLoadFailure(stderr: string): boolean {
  if (!/--model-draft|model-draft|draft model/i.test(stderr)) return false;
  return /out of memory|failed to allocate|cudamalloc|cuda error|vram/i.test(stderr);
}

export class LocalGemmaRuntime {
  private child: ChildProcessWithoutNullStreams | null = null;
  private currentSystem: string | null = null;
  private currentSessionId: string | null = null;
  private kvType: KvCacheType = resolveKvType(process.env["WRITER_LOCAL_KV_TYPE"]);
  private kvFallbackUsed = false;
  private stderrBuf = "";
  private readonly kvPinned = process.env["WRITER_LOCAL_KV_TYPE"] !== undefined;
  private draftFallbackUsed = false;
  private readonly draftPinned = process.env["WRITER_LOCAL_DRAFT_MODEL"] !== undefined;
  private busy = false;
  private queue: Array<() => void> = [];
  private idleTimer: NodeJS.Timeout | null = null;
  private stdoutBuf = "";
  private turnsHandled = 0;
  // Restart the resident process after this many turns to bound context growth.
  private static readonly MAX_TURNS = 50;
  private readonly opts: LocalGemmaRuntimeOptions;

  constructor(opts: LocalGemmaRuntimeOptions) {
    this.opts = opts;
  }

  private effectiveDraftPath(): string | null {
    if (this.draftFallbackUsed) return null;
    return resolveDraftModelPath(
      process.env["WRITER_LOCAL_DRAFT_MODEL"],
      this.opts.draftSettings ?? { enabled: false, path: null }
    );
  }

  /** True when a process is alive (resident in VRAM). */
  get resident(): boolean {
    return this.child !== null && this.child.exitCode === null;
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private armIdleTimer(): void {
    this.clearIdleTimer();
    const ms = idleMs();
    if (ms <= 0) return; // eviction disabled
    this.idleTimer = setTimeout(() => this.evict(), ms);
    this.idleTimer.unref?.();
  }

  /** Terminate the resident process and free VRAM. */
  evict(): void {
    this.clearIdleTimer();
    const child = this.child;
    this.child = null;
    this.currentSystem = null;
    this.currentSessionId = null;
    this.stdoutBuf = "";
    if (child && child.exitCode === null) {
      try {
        child.stdin.write("/exit\n");
      } catch {
        // ignore
      }
      child.kill("SIGTERM");
    }
  }

  /** Called on daemon shutdown so no GPU process is orphaned. */
  shutdown(): void {
    this.evict();
  }

  private spawnProcess(system: string, sessionId: string): void {
    const { binary, modelPath, gpuLayers, contextSize } = this.opts;
    const ctxSize = resolveCtxSize(process.env["WRITER_LOCAL_CTX_SIZE"], contextSize);
    const args = buildSpawnArgs({
      modelPath,
      ctxSize,
      gpuLayers,
      kvType: this.kvType,
      flashAttn: resolveFlashAttn(process.env["WRITER_LOCAL_FLASH_ATTN"]),
      ubatch: resolveUbatch(process.env["WRITER_LOCAL_UBATCH"]),
      draftModelPath: this.effectiveDraftPath(),
      specType: resolveSpecType(process.env["WRITER_LOCAL_SPEC_TYPE"]),
      system
    });
    const child = spawn(binary, args, { cwd: dirname(binary), stdio: ["pipe", "pipe", "pipe"] });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    this.stderrBuf = "";
    child.stdout.on("data", (chunk: string) => { this.stdoutBuf += chunk; });
    child.stderr.on("data", (chunk: string) => { this.stderrBuf += chunk; });
    child.on("exit", () => {
      if (this.child === child) {
        this.child = null;
        this.currentSystem = null;
        this.currentSessionId = null;
        this.stdoutBuf = "";
      }
    });
    this.child = child;
    this.currentSystem = system;
    this.currentSessionId = sessionId;
    this.stdoutBuf = "";
  }

  /** Wait until the resident process prints its first ready prompt. */
  private async waitForReady(timeout: number): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (!this.resident) throw new Error("Local Gemma process exited before ready.");
      if (READY_PROMPT.test(this.stdoutBuf)) {
        this.stdoutBuf = ""; // discard banner up to the ready prompt
        return;
      }
      await delay(50);
    }
    throw new Error("Local Gemma process did not become ready in time.");
  }

  /** Ensure a process is alive for the given system prompt. */
  private async ensureProcess(system: string, sessionId: string): Promise<void> {
    if (
      shouldReuseProcess({
        resident: this.resident,
        currentSystem: this.currentSystem,
        system,
        currentSessionId: this.currentSessionId,
        sessionId,
        turnsHandled: this.turnsHandled,
        maxTurns: LocalGemmaRuntime.MAX_TURNS
      })
    ) {
      return;
    }
    if (this.resident) this.evict();
    this.turnsHandled = 0;
    this.spawnProcess(system, sessionId);
    try {
      await this.waitForReady(turnTimeoutMs());
    } catch (err) {
      // Draft-model fallback: if the draft model caused a VRAM failure and it wasn't
      // forced via env, retry without it.
      if (
        !this.draftPinned &&
        !this.draftFallbackUsed &&
        this.effectiveDraftPath() !== null &&
        isDraftLoadFailure(this.stderrBuf)
      ) {
        this.draftFallbackUsed = true;
        if (this.resident) this.evict();
        this.spawnProcess(system, sessionId);
        await this.waitForReady(turnTimeoutMs());
        console.error("[local-gemma] draft model disabled: load failed (insufficient VRAM)");
        return;
      }
      if (!this.kvPinned && !this.kvFallbackUsed && this.kvType === "f16" && isVramLoadFailure(this.stderrBuf)) {
        this.kvFallbackUsed = true;
        this.kvType = "q8_0";
        if (this.resident) this.evict();
        this.spawnProcess(system, sessionId);
        await this.waitForReady(turnTimeoutMs());
        return;
      }
      throw err;
    }
  }

  private acquire(): Promise<void> {
    if (!this.busy) {
      this.busy = true;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.queue.push(resolve));
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.busy = false;
    }
  }

  /**
   * Run one turn. Returns the model's response text for this turn (already
   * stripped of the footer). Throws on timeout or process death.
   */
  async runTurn(system: string, userText: string, sessionId: string): Promise<string> {
    await this.acquire();
    try {
      await this.ensureProcess(system, sessionId);
      this.clearIdleTimer();

      // Send the user turn. --simple-io does NOT echo input back, so the
      // response is everything between here and the per-turn footer.
      // Note: we deliberately do NOT /clear between turns — the daemon already
      // injects conversation history into each prompt, so accumulated context
      // is redundant. To bound context growth we restart the process once it
      // has handled many turns (see ensureProcess / turnsHandled).
      this.stdoutBuf = "";
      const child = this.child!;
      child.stdin.write(userText.replace(/\r?\n/g, " ") + "\n");

      const raw = await this.waitForTurnFooter(turnTimeoutMs());
      this.turnsHandled += 1;
      return stripTurn(raw);
    } finally {
      this.armIdleTimer();
      this.release();
    }
  }

  /** Accumulate stdout until the per-turn footer appears; return the slice. */
  private async waitForTurnFooter(timeout: number): Promise<string> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (!this.resident) throw new Error("Local Gemma process exited during generation.");
      const m = TURN_FOOTER.exec(this.stdoutBuf);
      if (m) {
        if (process.env["WRITER_LOCAL_PERF_LOG"] === "1") {
          const metrics = parseTurnMetrics(m[0]);
          const tail = metrics.draftAccepted !== null && metrics.draftProposed !== null
            ? `, draft ${metrics.draftAccepted}/${metrics.draftProposed} accepted`
            : "";
          console.error(
            `[local-gemma] prompt ${metrics.promptTokensPerSec ?? "?"} t/s, ` +
            `eval ${metrics.evalTokensPerSec ?? "?"} t/s${tail}`
          );
        }
        const slice = this.stdoutBuf.slice(0, m.index);
        // Drop the footer and anything after it from the buffer; the next ready
        // prompt will be discarded at the start of the next turn.
        this.stdoutBuf = this.stdoutBuf.slice(m.index + m[0].length);
        return slice;
      }
      await delay(40);
    }
    // Timed out — treat as a crash so the next turn cold-starts.
    this.evict();
    throw new Error("Local Gemma turn timed out.");
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type TurnMetrics = {
  promptTokensPerSec: number | null;
  evalTokensPerSec: number | null;
  draftAccepted: number | null;
  draftProposed: number | null;
};

/**
 * Parse llama-cli's per-turn footer, e.g.
 *   "[ Prompt: 210.34 t/s | Predicted: 52.10 t/s ]"
 * Generation rate may be labelled Predicted / eval / generation. Returns nulls
 * for any field that is not present; never throws.
 */
export function parseTurnMetrics(footer: string): TurnMetrics {
  const num = (re: RegExp): number | null => {
    const m = re.exec(footer);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  };
  const draftPair = /draft[^\]|]*?([\d.]+)\s*\/\s*([\d.]+)/i.exec(footer);
  const draftAccepted = draftPair ? Number(draftPair[1]) : null;
  const draftProposed = draftPair ? Number(draftPair[2]) : null;
  return {
    promptTokensPerSec: num(/prompt[^\]|]*?([\d.]+)\s*t\/s/i),
    evalTokensPerSec: num(/(?:predicted|eval|generation|gen)[^\]|]*?([\d.]+)\s*t\/s/i),
    draftAccepted: Number.isFinite(draftAccepted as number) ? draftAccepted : null,
    draftProposed: Number.isFinite(draftProposed as number) ? draftProposed : null
  };
}

/** Strip ANSI codes, leading ready-prompt, and CRLF from a turn slice. */
export function stripTurn(raw: string): string {
  // eslint-disable-next-line no-control-regex
  let text = raw.replace(/\x1b?\[[0-9;]*m/g, "").replace(/\r\n/g, "\n");
  // Remove a leading ready prompt line ("> ") if present.
  text = text.replace(/^>\s*\n?/, "");
  // Defensive: strip a thinking block if the model emitted one anyway.
  const endThink = text.search(/\[End thinking\]/i);
  if (endThink !== -1) text = text.slice(endThink + "[End thinking]".length);
  text = text.replace(/\[Start thinking\][\s\S]*$/i, "");
  return text.trim();
}
