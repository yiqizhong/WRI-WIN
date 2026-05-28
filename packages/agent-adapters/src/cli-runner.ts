import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";

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
    const child = spawn(options.executable, options.args, {
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
  const child = spawn(options.executable, options.args, {
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
  const isWindows = process.platform === "win32";
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
