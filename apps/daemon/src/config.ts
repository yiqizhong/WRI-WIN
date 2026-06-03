import { homedir } from "node:os";
import { join } from "node:path";
import revisionJson from "@writer/contracts/daemon-api-revision.json";

const defaultApiRevision: string = revisionJson.revision;

export type LogLevel = "debug" | "info" | "warn" | "error";

export type DaemonConfig = {
  host: string;
  port: number;
  logDir: string;
  logLevel: LogLevel;
  version: string;
  apiRevision: string;
  packaged: boolean;
};

const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid daemon port: ${value ?? fallback}`);
  }
  return parsed;
}

function parseLogLevel(value: string | undefined): LogLevel {
  const level = (value ?? "info").toLowerCase();
  if (!LOG_LEVELS.includes(level as LogLevel)) {
    throw new Error(`Invalid log level: ${value}`);
  }
  return level as LogLevel;
}

export function loadDaemonConfig(env: NodeJS.ProcessEnv = process.env): DaemonConfig {
  return {
    host: env.WRITER_DAEMON_HOST ?? "127.0.0.1",
    port: parsePort(env.WRITER_DAEMON_PORT, 47631),
    logDir: env.WRITER_DAEMON_LOG_DIR ?? join(homedir(), ".writer", "logs"),
    logLevel: parseLogLevel(env.WRITER_DAEMON_LOG_LEVEL),
    version: env.WRITER_DAEMON_VERSION ?? "0.1.0",
    apiRevision: env.WRITER_DAEMON_API_REVISION ?? defaultApiRevision,
    packaged: env.WRITER_DAEMON_PACKAGED === "true"
  };
}
