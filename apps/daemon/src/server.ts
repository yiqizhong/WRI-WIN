import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { DaemonConfig } from "./config";
import type { DaemonLogger } from "./logger";

export type DaemonServer = {
  close: () => Promise<void>;
};

export function createDaemonServer(
  config: DaemonConfig,
  logger: DaemonLogger,
  onRequest: (request: IncomingMessage, response: ServerResponse) => void
): Promise<DaemonServer> {
  const server = createServer(onRequest);

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      logger.info("Daemon listening", {
        host: config.host,
        port: config.port,
        version: config.version
      });
      resolve({
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => (error ? closeReject(error) : closeResolve()));
          })
      });
    });
  });
}
