import type { ServerResponse } from "node:http";

import chokidar from "chokidar";

import { invalidateCache, setCachedTree } from "./cache";
import { discoverGuidelines, guidelinesDir } from "./discovery";
import { registerImporter } from "./importers/index";
import { MarkdownImporter } from "./importers/markdown-importer";

registerImporter(new MarkdownImporter());

const sseClients = new Set<ServerResponse>();

export function addSseClient(res: ServerResponse): void {
  sseClients.add(res);
  res.on("close", () => sseClients.delete(res));
}

function broadcastGuidelinesChanged(): void {
  const data = `data: ${JSON.stringify({ event: "guidelines:changed" })}\n\n`;
  for (const client of sseClients) {
    client.write(data);
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function reload(): Promise<void> {
  invalidateCache();
  const result = await discoverGuidelines();
  setCachedTree(result);
  broadcastGuidelinesChanged();
}

function scheduleReload(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void reload();
  }, 500);
}

export async function startGuidelinesWatcher(): Promise<void> {
  const result = await discoverGuidelines();
  setCachedTree(result);

  const dir = guidelinesDir();
  const watcher = chokidar.watch(dir, {
    ignoreInitial: true,
    persistent: true,
    usePolling: false,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 }
  });

  watcher.on("add", scheduleReload);
  watcher.on("change", scheduleReload);
  watcher.on("unlink", scheduleReload);
}

export async function forceReload(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  await reload();
}
