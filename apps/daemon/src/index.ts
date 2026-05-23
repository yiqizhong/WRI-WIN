import { loadDaemonConfig } from "./config";
import { createDaemonLogger } from "./logger";
import { createDaemonServer } from "./server";

async function startDaemon() {
  const config = loadDaemonConfig();
  const logger = await createDaemonLogger(config);

  logger.info("Starting Writer daemon", {
    logDir: config.logDir,
    logLevel: config.logLevel
  });

  const server = await createDaemonServer(config, logger, (_request, response) => {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
  });

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
