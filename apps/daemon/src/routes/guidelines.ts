import type { IncomingMessage, ServerResponse } from "node:http";

import { getCachedTree } from "../guidelines/cache";
import { discoverGuidelines } from "../guidelines/discovery";
import { buildInheritanceTree } from "../guidelines/inheritance";
import { buildSnapshot } from "../guidelines/snapshot";
import { addSseClient, forceReload } from "../guidelines/watcher";
import { invalidRequest, notFound } from "../errors";

function matchRoute(
  request: IncomingMessage,
  method: string,
  pattern: RegExp
): RegExpMatchArray | null {
  if (request.method !== method) return null;
  return (request.url ?? "").match(pattern);
}

export async function handleGuidelinesRequest(
  request: IncomingMessage,
  response: ServerResponse
): Promise<boolean> {
  const url = request.url ?? "";

  // GET /guidelines
  if (request.method === "GET" && url === "/guidelines") {
    const cached = getCachedTree() ?? (await discoverGuidelines());
    const tree = buildInheritanceTree(cached);

    const guidelines = [
      ...(tree.company ? [tree.company] : []),
      ...tree.products
    ].map((g) => ({
      id: g.id,
      scope: g.scope,
      version: g.version,
      ruleCount: g.rules.length,
      termCount: g.glossary.length,
      parseStatus: "ok" as const
    }));

    const errorEntries = cached.entries
      .filter((e) => e.status === "error")
      .map((e) => ({
        id: e.filePath,
        scope: "company" as const,
        version: "unknown",
        ruleCount: 0,
        termCount: 0,
        parseStatus: "error" as const,
        parseError: e.status === "error" ? e.error : undefined
      }));

    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        guidelines: [...guidelines, ...errorEntries],
        companyMissing: tree.companyMissing,
        ...(tree.conflictError ? { conflictError: tree.conflictError } : {})
      })
    );
    return true;
  }

  // GET /guidelines/events (SSE)
  if (request.method === "GET" && url === "/guidelines/events") {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive"
    });
    response.write(":\n\n");
    addSseClient(response);
    return true;
  }

  // POST /guidelines/reload
  if (request.method === "POST" && url === "/guidelines/reload") {
    await forceReload();
    response.writeHead(204);
    response.end();
    return true;
  }

  // GET /guidelines/:id
  const idMatch = matchRoute(request, "GET", /^\/guidelines\/([^/]+)$/);
  if (idMatch) {
    const id = idMatch[1];
    const cached = getCachedTree() ?? (await discoverGuidelines());
    const tree = buildInheritanceTree(cached);
    const all = [...(tree.company ? [tree.company] : []), ...tree.products];
    const guideline = all.find((g) => g.id === id);
    if (!guideline) {
      notFound(response, `Guideline "${id}" not found.`);
      return true;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(guideline));
    return true;
  }

  // GET /guidelines/:id/sources
  const sourcesMatch = matchRoute(request, "GET", /^\/guidelines\/([^/]+)\/sources$/);
  if (sourcesMatch) {
    const id = sourcesMatch[1];
    const cached = getCachedTree() ?? (await discoverGuidelines());
    const tree = buildInheritanceTree(cached);
    const all = [...(tree.company ? [tree.company] : []), ...tree.products];
    const guideline = all.find((g) => g.id === id);
    if (!guideline) {
      notFound(response, `Guideline "${id}" not found.`);
      return true;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ filePath: guideline._filePath }));
    return true;
  }

  // GET /guidelines/:id/snapshot
  const snapshotMatch = matchRoute(request, "GET", /^\/guidelines\/([^/]+)\/snapshot$/);
  if (snapshotMatch) {
    const id = snapshotMatch[1];
    const cached = getCachedTree() ?? (await discoverGuidelines());
    const tree = buildInheritanceTree(cached);
    const all = [...(tree.company ? [tree.company] : []), ...tree.products];
    const guideline = all.find((g) => g.id === id);
    if (!guideline) {
      notFound(response, `Guideline "${id}" not found.`);
      return true;
    }
    const snapshot = buildSnapshot(guideline);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(snapshot));
    return true;
  }

  return false;
}
