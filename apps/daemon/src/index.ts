import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { shutdownLocalGemmaRuntime } from "@writer/agent-adapters";

import { loadDaemonConfig } from "./config";
import { startGuidelinesWatcher } from "./guidelines/watcher";
import { createDaemonLogger } from "./logger";
import { autoConnectFigmaMcp } from "./mcp";
import { createRequestHandler } from "./router";
import { createDaemonServer } from "./server";
import { createDaemonState } from "./state";

async function startDaemon() {
  const config = loadDaemonConfig();
  const logger = await createDaemonLogger(config);

  logger.info("Starting Writer daemon", {
    logDir: config.logDir,
    logLevel: config.logLevel
  });

  const state = await createDaemonState();
  logger.info("Platform store loaded", { dataDir: state.store.dataDir });

  // Share the per-launch auth token with the desktop app. createDaemonState()
  // loads the platform store, which creates ~/.writer, so the dir exists here;
  // mkdir defensively in case the store layout changes. 0600 keeps it readable
  // only by the current user.
  try {
    const writerDir = join(homedir(), ".writer");
    mkdirSync(writerDir, { recursive: true });
    writeFileSync(join(writerDir, "daemon-token"), config.token, { mode: 0o600 });
  } catch (error) {
    logger.warn("Could not write daemon token file", {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  await startGuidelinesWatcher();
  logger.info("Guidelines watcher started");

  // Restore the Figma MCP connection from stored tokens before the server
  // starts accepting requests. This ensures /mcp/servers returns the correct
  // enabled state on the desktop's first fetch after daemon startup.
  // Stays disabled (no browser prompt) when no valid tokens exist.
  try {
    const figma = await autoConnectFigmaMcp(state);
    logger.info("Figma MCP auto-connect", {
      status: figma.status,
      tools: figma.tools?.length ?? 0
    });
  } catch (error: unknown) {
    logger.warn("Figma MCP auto-connect failed", {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  const server = await createDaemonServer(config, logger, createRequestHandler(config, state));

  const shutdown = async (signal: string) => {
    logger.info("Shutting down daemon", { signal });
    shutdownLocalGemmaRuntime();
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

/**
 * Persist a startup failure to disk. A crash before the HTTP server starts
 * listening (e.g. EADDRINUSE, unwritable data dir) otherwise only reaches
 * stderr, which is invisible in a packaged desktop build — leaving the
 * "Daemon did not become ready" dialog with no captured cause. Best-effort:
 * try the configured log dir, then a tmp fallback in case the data dir itself
 * is what's unwritable.
 */
function persistStartupFailure(error: unknown): void {
  const line = `[writer-daemon] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "error",
    message: "Failed to start",
    meta: { error: error instanceof Error ? (error.stack ?? error.message) : String(error) }
  })}\n`;

  const logDir = process.env.WRITER_DAEMON_LOG_DIR ?? join(homedir(), ".writer", "logs");
  for (const dir of [logDir, join(tmpdir(), "writer-logs")]) {
    try {
      mkdirSync(dir, { recursive: true });
      appendFileSync(join(dir, "daemon.log"), line, "utf8");
      return;
    } catch {
      // Try the next location.
    }
  }
}

startDaemon().catch((error: unknown) => {
  console.error("[writer-daemon] Failed to start", error);
  persistStartupFailure(error);
  process.exit(1);
});
