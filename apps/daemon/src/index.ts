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

startDaemon().catch((error: unknown) => {
  console.error("[writer-daemon] Failed to start", error);
  process.exit(1);
});
