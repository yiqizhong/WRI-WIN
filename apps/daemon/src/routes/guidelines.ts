import type { IncomingMessage, ServerResponse } from "node:http";

import { parseUploadGlossaryInput, parseUploadGuidelineInput } from "@writer/contracts";

import { getCachedTree } from "../guidelines/cache";
import { discoverGuidelines } from "../guidelines/discovery";
import { GLOSSARY_CSV_TEMPLATE } from "../guidelines/glossary/csv-importer";
import { buildInheritanceTree } from "../guidelines/inheritance";
import { buildSnapshot } from "../guidelines/snapshot";
import { GUIDELINE_MD_TEMPLATE } from "../guidelines/templates";
import { addSseClient, forceReload } from "../guidelines/watcher";
import {
  deleteGlossary,
  deleteGuideline,
  writeGlossary,
  writeGuideline
} from "../guidelines/writer";
import { invalidRequest, notFound, sendApiError } from "../errors";
import { readJsonBody } from "../http";

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

  // GET /guidelines/templates/guideline.md
  if (request.method === "GET" && url === "/guidelines/templates/guideline.md") {
    response.writeHead(200, {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": 'attachment; filename="guideline-template.md"'
    });
    response.end(GUIDELINE_MD_TEMPLATE);
    return true;
  }

  // GET /guidelines/templates/glossary.csv
  if (request.method === "GET" && url === "/guidelines/templates/glossary.csv") {
    response.writeHead(200, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="glossary-template.csv"'
    });
    response.end(GLOSSARY_CSV_TEMPLATE);
    return true;
  }

  // GET /glossaries
  if (request.method === "GET" && url === "/glossaries") {
    const cached = getCachedTree() ?? (await discoverGuidelines());
    const glossaries = cached.glossaries.map((g) =>
      g.status === "ok"
        ? {
            id: g.id,
            name: g.name,
            format: g.format,
            termCount: g.terms.length,
            filePath: g.filePath,
            parseStatus: "ok" as const
          }
        : {
            id: g.filePath,
            name: g.filePath.split("/").pop() ?? g.filePath,
            format: g.format,
            termCount: 0,
            filePath: g.filePath,
            parseStatus: "error" as const,
            parseError: g.error
          }
    );
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ glossaries }));
    return true;
  }

  // POST /guidelines/upload
  if (request.method === "POST" && url === "/guidelines/upload") {
    try {
      const body = parseUploadGuidelineInput(await readJsonBody(request));
      const result = await writeGuideline(body);
      if (!result.ok) {
        if (result.code === "conflict") {
          sendApiError(response, {
            code: "conflict",
            message: result.message,
            guidance: "Pass `overwrite: true` to replace the existing file."
          });
          return true;
        }
        invalidRequest(response, result.message);
        return true;
      }
      await forceReload();
      response.writeHead(201, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, filePath: result.filePath }));
    } catch {
      invalidRequest(response, "Invalid upload payload.", "Provide filename, content, scope.");
    }
    return true;
  }

  // POST /glossary/upload
  if (request.method === "POST" && url === "/glossary/upload") {
    try {
      const body = parseUploadGlossaryInput(await readJsonBody(request));
      const result = await writeGlossary(body);
      if (!result.ok) {
        if (result.code === "conflict") {
          sendApiError(response, {
            code: "conflict",
            message: result.message,
            guidance: "Pass `overwrite: true` to replace the existing file."
          });
          return true;
        }
        invalidRequest(response, result.message);
        return true;
      }
      await forceReload();
      response.writeHead(201, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, filePath: result.filePath }));
    } catch {
      invalidRequest(response, "Invalid upload payload.", "Provide filename, content, format.");
    }
    return true;
  }

  // DELETE /guidelines/:id
  const delGuideline = matchRoute(request, "DELETE", /^\/guidelines\/([^/]+)$/);
  if (delGuideline) {
    const id = decodeURIComponent(delGuideline[1]);
    const cached = getCachedTree() ?? (await discoverGuidelines());
    const entry = cached.entries.find((e) => e.status === "ok" && e.guideline.id === id);
    if (!entry || entry.status !== "ok") {
      notFound(response, `Guideline "${id}" not found.`);
      return true;
    }
    const result = await deleteGuideline(entry.filePath);
    if (!result.ok) {
      invalidRequest(response, result.message);
      return true;
    }
    await forceReload();
    response.writeHead(204);
    response.end();
    return true;
  }

  // DELETE /glossaries/:id
  const delGlossary = matchRoute(request, "DELETE", /^\/glossaries\/([^/]+)$/);
  if (delGlossary) {
    const id = decodeURIComponent(delGlossary[1]);
    const cached = getCachedTree() ?? (await discoverGuidelines());
    const entry = cached.glossaries.find(
      (g) => (g.status === "ok" && g.id === id) || (g.status === "error" && g.filePath.endsWith("/" + id))
    );
    if (!entry) {
      notFound(response, `Glossary "${id}" not found.`);
      return true;
    }
    const result = await deleteGlossary(entry.filePath);
    if (!result.ok) {
      invalidRequest(response, result.message);
      return true;
    }
    await forceReload();
    response.writeHead(204);
    response.end();
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
