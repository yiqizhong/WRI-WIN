import type { ServerResponse } from "node:http";

import { sendApiError, invalidRequest } from "../errors";
import { forceReload } from "./watcher";
import type { WriteOutcome } from "./writer";

export async function respondToWrite(
  response: ServerResponse,
  result: WriteOutcome,
  options?: { reload?: boolean; status?: number }
): Promise<void> {
  if (!result.ok) {
    if (result.code === "conflict") {
      sendApiError(response, {
        code: "conflict",
        message: result.message,
        guidance: "Pass `overwrite: true` to replace the existing file."
      });
      return;
    }
    invalidRequest(response, result.message);
    return;
  }
  if (options?.reload !== false) {
    await forceReload();
  }
  response.writeHead(options?.status ?? 201, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true, filePath: result.filePath }));
}

export function sendMarkdown(
  response: ServerResponse,
  filename: string,
  content: string
): void {
  response.writeHead(200, {
    "content-type": "text/markdown; charset=utf-8",
    "content-disposition": `attachment; filename="${filename}"`
  });
  response.end(content);
}

export function sendCsv(response: ServerResponse, filename: string, content: string): void {
  response.writeHead(200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${filename}"`
  });
  response.end(content);
}
