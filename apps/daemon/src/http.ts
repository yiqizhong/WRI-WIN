import type { IncomingMessage } from "node:http";

export async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  return JSON.parse(raw) as unknown;
}

export function getQueryParam(url: string | undefined, key: string): string | null {
  if (!url) {
    return null;
  }

  const queryIndex = url.indexOf("?");
  if (queryIndex === -1) {
    return null;
  }

  const params = new URLSearchParams(url.slice(queryIndex + 1));
  return params.get(key);
}
