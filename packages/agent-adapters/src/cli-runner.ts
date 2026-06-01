import { spawn, type ChildProcess } from "node:child_process";
import { platform } from "node:os";
import { createInterface } from "node:readline";

const isWindows = platform() === "win32";

// On Windows, node's spawn() cannot launch a `.cmd`/`.bat` shim directly — it
// rejects with EINVAL (a deliberate change after CVE-2024-27980). Agent CLIs
// like codex, claude, and cursor-agent install as `.cmd` shims, so they must be
// run via the command interpreter.
//
// We do NOT use `{ shell: true }` for this: with shell:true node concatenates
// args into one command line, so a prompt containing `&`, `|`, `>` etc. would
// break out and execute arbitrary commands. Instead we invoke
// `cmd.exe /d /s /c <script> <args…>` and pass the args as a normal argv array,
// letting node quote each one. `cmd` then receives them as distinct literal
// arguments — no interpolation, no injection.
// Escape characters that cmd.exe interprets (`& | < > ^ ( ) " %`) so a script
// argument is passed through verbatim. node's own arg quoting protects the
// CommandLineToArgvW layer; this protects the extra cmd.exe parsing layer that
// runs when we invoke a `.cmd`/`.bat` via cmd.exe. Together they prevent a
// prompt like `a & whoami` from breaking out and executing.
function escapeCmdMetacharacters(arg: string): string {
  return arg.replace(/[()%!^"<>&|]/g, "^$&");
}

function resolveSpawn(executable: string, args: string[]): { command: string; args: string[] } {
  if (isWindows) {
    const lower = executable.toLowerCase();
    if (lower.endsWith(".cmd") || lower.endsWith(".bat")) {
      const comspec = process.env.ComSpec ?? "cmd.exe";
      const safeArgs = args.map(escapeCmdMetacharacters);
      return { command: comspec, args: ["/d", "/s", "/c", executable, ...safeArgs] };
    }
  }
  return { command: executable, args };
}

export type CliRunOptions = {
  executable: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
};

export type CliRunResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  cancelled: boolean;
  errorCode?: string;
  spawnError?: string;
};

export async function runCliCommand(options: CliRunOptions): Promise<CliRunResult> {
  return new Promise((resolve) => {
    const spawnTarget = resolveSpawn(options.executable, options.args);
    const child = spawn(spawnTarget.command, spawnTarget.args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let cancelled = false;
    let errorCode: string | undefined;
    let spawnError: string | undefined;
    let settled = false;

    const finish = (exitCode: number | null) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode, timedOut, cancelled, errorCode, spawnError });
    };

    const timer =
      options.timeoutMs !== undefined
        ? setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
          }, options.timeoutMs)
        : undefined;

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      errorCode = error.code;
      spawnError = error.message;
      stderr += error.message;
      finish(1);
    });

    child.on("close", (code) => {
      finish(code);
    });

    child.on("disconnect", () => {
      if (!settled) {
        cancelled = true;
        finish(null);
      }
    });
  });
}

export type CliStreamHandle = {
  process: ChildProcess;
  lines: AsyncIterable<string>;
  cancel: () => void;
};

export function spawnCliStream(options: CliRunOptions): CliStreamHandle {
  const spawnTarget = resolveSpawn(options.executable, options.args);
  const child = spawn(spawnTarget.command, spawnTarget.args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const stdout = createInterface({ input: child.stdout! });

  async function* lines(): AsyncIterable<string> {
    for await (const line of stdout) {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        yield trimmed;
      }
    }
  }

  return {
    process: child,
    lines: lines(),
    cancel: () => {
      child.kill("SIGTERM");
    }
  };
}

export async function commandExists(command: string): Promise<string | null> {
  // Windows has no `which`; the equivalent is `where`. `where` is resolved via
  // PATH and prints one CRLF-terminated absolute path per match.
  const isWindows = platform() === "win32";
  const result = await runCliCommand({
    executable: isWindows ? "where" : "/usr/bin/which",
    args: [command],
    timeoutMs: 5_000
  });

  if (result.exitCode !== 0) {
    return null;
  }

  const path = result.stdout.trim().split(/\r?\n/)[0];
  return path && path.length > 0 ? path : null;
}
