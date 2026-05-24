import type { IncomingMessage, ServerResponse } from "node:http";

import { z } from "zod";

import { parseUploadCompanyGlossaryInput } from "@writer/contracts";

import { getCachedTree } from "../guidelines/cache";
import { discoverGuidelines } from "../guidelines/discovery";
import { GLOSSARY_CSV_TEMPLATE } from "../guidelines/glossary/csv-importer";
import { buildResolvedTree, collectFlatGuidelines } from "../guidelines/inheritance";
import { buildSnapshot } from "../guidelines/snapshot";
import { GUIDELINE_MD_TEMPLATE } from "../guidelines/templates";
import {
  findGuidelineFilePath,
  toGuidelinesTreeApi,
  toLegacyGlossaryList,
  toLegacyGuidelineList
} from "../guidelines/tree-api";
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

  // GET /guidelines — 3-layer tree + v1 flat list for desktop until WRI-119
  if (request.method === "GET" && url === "/guidelines") {
    const cached = getCachedTree() ?? (await discoverGuidelines());
    const legacy = toLegacyGuidelineList(cached);
    const tree = toGuidelinesTreeApi(cached);

    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        ...tree,
        guidelines: legacy.guidelines,
        companyMissing: legacy.companyMissing
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
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(toLegacyGlossaryList(cached)));
    return true;
  }

  // POST /guidelines/upload (v1 body; maps to 3-layer paths)
  if (request.method === "POST" && url === "/guidelines/upload") {
    try {
      const raw = await readJsonBody(request);
      const legacy = z
        .object({
          filename: z.string().min(1),
          content: z.string().min(1),
          scope: z.enum(["company", "product"]).optional(),
          layer: z.enum(["company-base", "software-writing", "product-writing"]).optional(),
          productId: z.string().min(1).optional(),
          overwrite: z.boolean().optional()
        })
        .parse(raw);
      const layer =
        legacy.layer ??
        (legacy.scope === "company" ? "company-base" : ("product-writing" as const));
      const result = await writeGuideline({
        filename: legacy.filename,
        content: legacy.content,
        layer,
        productId: legacy.productId ?? legacy.filename.replace(/\.md$/, ""),
        overwrite: legacy.overwrite
      });
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
      invalidRequest(response, "Invalid upload payload.", "Provide filename, content, and layer or scope.");
    }
    return true;
  }

  // POST /glossary/upload
  if (request.method === "POST" && url === "/glossary/upload") {
    try {
      const body = parseUploadCompanyGlossaryInput(await readJsonBody(request));
      const result = await writeGlossary({
        filename: `company-glossary.${body.format}`,
        content: body.content,
        format: body.format,
        overwrite: body.overwrite
      });
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
    const filePath = findGuidelineFilePath(cached, id);
    if (!filePath) {
      notFound(response, `Guideline "${id}" not found.`);
      return true;
    }
    const result = await deleteGuideline(filePath);
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
    const glossary = toLegacyGlossaryList(cached).glossaries.find((g) => g.id === id);
    if (!glossary) {
      notFound(response, `Glossary "${id}" not found.`);
      return true;
    }
    const result = await deleteGlossary(glossary.filePath);
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
    const resolved = buildResolvedTree(cached);
    const guideline = collectFlatGuidelines(resolved).find((g) => g.id === id);
    if (!guideline) {
      notFound(response, `Guideline "${id}" not found.`);
      return true;
    }
    const { _filePath, _contentHash, _prose, ...apiGuideline } = guideline;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(apiGuideline));
    return true;
  }

  // GET /guidelines/:id/sources
  const sourcesMatch = matchRoute(request, "GET", /^\/guidelines\/([^/]+)\/sources$/);
  if (sourcesMatch) {
    const id = sourcesMatch[1];
    const cached = getCachedTree() ?? (await discoverGuidelines());
    const resolved = buildResolvedTree(cached);
    const guideline = collectFlatGuidelines(resolved).find((g) => g.id === id);
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
    const resolved = buildResolvedTree(cached);
    const guideline = collectFlatGuidelines(resolved).find((g) => g.id === id);
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
