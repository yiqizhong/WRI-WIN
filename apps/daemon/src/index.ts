import { loadDaemonConfig } from "./config";
import { startGuidelinesWatcher } from "./guidelines/watcher";
import { createDaemonLogger } from "./logger";
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

  const server = await createDaemonServer(config, logger, createRequestHandler(config, state));

  const shutdown = async (signal: string) => {
    logger.info("Shutting down daemon", { signal });
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
