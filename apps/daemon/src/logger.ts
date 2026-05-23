import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import type { DaemonConfig, LogLevel } from "./config";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export type DaemonLogger = {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

export async function createDaemonLogger(config: DaemonConfig): Promise<DaemonLogger> {
  await mkdir(config.logDir, { recursive: true });
  const logFile = join(config.logDir, "daemon.log");

  const write = async (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[config.logLevel]) {
      return;
    }

    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta ? { meta } : {})
    });

    const formatted = `[writer-daemon] ${line}`;
    console[level === "debug" ? "log" : level](formatted);
    await appendFile(logFile, `${formatted}\n`, "utf8");
  };

  return {
    debug: (message, meta) => void write("debug", message, meta),
    info: (message, meta) => void write("info", message, meta),
    warn: (message, meta) => void write("warn", message, meta),
    error: (message, meta) => void write("error", message, meta)
  };
}
