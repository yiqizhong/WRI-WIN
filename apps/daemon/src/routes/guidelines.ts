import type { IncomingMessage, ServerResponse } from "node:http";

import { z } from "zod";

import {
  parseCreateProductInput,
  parseUploadCompanyBaseInput,
  parseUploadCompanyGlossaryInput,
  parseUploadProductBackgroundInput,
  parseUploadProductGlossaryInput,
  parseUploadProductWritingGuideInput,
  parseUploadSoftwareWritingInput
} from "@writer/contracts";

import { getCachedTree } from "../guidelines/cache";
import { discoverGuidelines } from "../guidelines/discovery";
import { GLOSSARY_CSV_TEMPLATE } from "../guidelines/glossary/csv-importer";
import { buildResolvedTree, collectFlatGuidelines } from "../guidelines/inheritance";
import { respondToWrite, sendCsv, sendMarkdown } from "../guidelines/route-helpers";
import { productBackgroundToMarkdown } from "../guidelines/serialize-background";
import { buildSnapshot, buildThreeLayerSnapshot } from "../guidelines/snapshot";
import {
  COMPANY_BASE_MD_TEMPLATE,
  GUIDELINE_MD_TEMPLATE,
  PRODUCT_BACKGROUND_MD_TEMPLATE,
  PRODUCT_WRITING_GUIDE_MD_TEMPLATE,
  SOFTWARE_WRITING_MD_TEMPLATE
} from "../guidelines/templates";
import {
  findGuidelineFilePath,
  findProductPackage,
  listProductPackages,
  toGuidelinesTreeApi,
  toLegacyGlossaryList,
  toLegacyGuidelineList
} from "../guidelines/tree-api";
import { addSseClient, forceReload } from "../guidelines/watcher";
import {
  createProduct,
  deleteCompanyGlossary,
  deleteGlossary,
  deleteGuideline,
  deleteProduct,
  deleteProductFile,
  writeCompanyBase,
  writeCompanyGlossary,
  writeGlossary,
  writeGuideline,
  writeProductBackground,
  writeProductGlossary,
  writeProductWritingGuide,
  writeSoftwareWriting
} from "../guidelines/writer";
import { invalidRequest, notFound } from "../errors";
import { readJsonBody } from "../http";

function matchRoute(
  request: IncomingMessage,
  method: string,
  pattern: RegExp
): RegExpMatchArray | null {
  if (request.method !== method) return null;
  return (request.url ?? "").match(pattern);
}

function parseUrl(url: string): URL {
  return new URL(url, "http://writer.local");
}

async function loadTree() {
  return getCachedTree() ?? (await discoverGuidelines());
}

export async function handleGuidelinesRequest(
  request: IncomingMessage,
  response: ServerResponse
): Promise<boolean> {
  const url = request.url ?? "";

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

  if (request.method === "POST" && url === "/guidelines/reload") {
    await forceReload();
    response.writeHead(204);
    response.end();
    return true;
  }

  // Templates
  const templateRoutes: Record<string, { filename: string; body: string; csv?: boolean }> = {
    "/guidelines/templates/company-base.md": {
      filename: "company-base-template.md",
      body: COMPANY_BASE_MD_TEMPLATE
    },
    "/guidelines/templates/software-writing.md": {
      filename: "software-writing-template.md",
      body: SOFTWARE_WRITING_MD_TEMPLATE
    },
    "/guidelines/templates/product-background.md": {
      filename: "product-background-template.md",
      body: PRODUCT_BACKGROUND_MD_TEMPLATE
    },
    "/guidelines/templates/product-writing-guide.md": {
      filename: "product-writing-guide-template.md",
      body: PRODUCT_WRITING_GUIDE_MD_TEMPLATE
    },
    "/guidelines/templates/glossary.csv": {
      filename: "glossary-template.csv",
      body: GLOSSARY_CSV_TEMPLATE,
      csv: true
    },
    "/guidelines/templates/guideline.md": {
      filename: "guideline-template.md",
      body: GUIDELINE_MD_TEMPLATE
    }
  };
  if (request.method === "GET" && templateRoutes[url]) {
    const t = templateRoutes[url];
    if (t.csv) sendCsv(response, t.filename, t.body);
    else sendMarkdown(response, t.filename, t.body);
    return true;
  }

  // GET /guidelines — tree + v1 flat list
  if (request.method === "GET" && url === "/guidelines") {
    const cached = await loadTree();
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

  // GET /guidelines/snapshot?productId=
  if (request.method === "GET" && url.startsWith("/guidelines/snapshot")) {
    const productId = parseUrl(url).searchParams.get("productId");
    const cached = await loadTree();
    const resolved = buildResolvedTree(cached);
    const snapshot = buildThreeLayerSnapshot(resolved, productId);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(snapshot));
    return true;
  }

  // --- Top-level slots ---
  if (request.method === "GET" && url === "/company-base") {
    const cached = await loadTree();
    const value = cached.companyBase?.status === "ok" ? cached.companyBase.value : null;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(value));
    return true;
  }

  if (request.method === "POST" && url === "/company-base/upload") {
    try {
      const body = parseUploadCompanyBaseInput(await readJsonBody(request));
      await respondToWrite(response, await writeCompanyBase(body));
    } catch {
      invalidRequest(response, "Invalid payload.", "Provide content and optional overwrite.");
    }
    return true;
  }

  if (request.method === "GET" && url === "/software-writing") {
    const cached = await loadTree();
    const value = cached.softwareWriting?.status === "ok" ? cached.softwareWriting.value : null;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(value));
    return true;
  }

  if (request.method === "POST" && url === "/software-writing/upload") {
    try {
      const body = parseUploadSoftwareWritingInput(await readJsonBody(request));
      await respondToWrite(response, await writeSoftwareWriting(body));
    } catch {
      invalidRequest(response, "Invalid payload.", "Provide content and optional overwrite.");
    }
    return true;
  }

  if (request.method === "GET" && url === "/company-glossary") {
    const cached = await loadTree();
    const terms = cached.companyGlossary?.status === "ok" ? cached.companyGlossary.value : null;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(terms));
    return true;
  }

  if (request.method === "POST" && url === "/company-glossary/upload") {
    try {
      const body = parseUploadCompanyGlossaryInput(await readJsonBody(request));
      await respondToWrite(response, await writeCompanyGlossary(body));
    } catch {
      invalidRequest(response, "Invalid payload.", "Provide content, format, and optional overwrite.");
    }
    return true;
  }

  if (request.method === "DELETE" && url === "/company-glossary") {
    const result = await deleteCompanyGlossary();
    if (!result.ok) {
      invalidRequest(response, result.message);
      return true;
    }
    await forceReload();
    response.writeHead(204);
    response.end();
    return true;
  }

  // --- Products ---
  if (request.method === "GET" && url === "/products") {
    const cached = await loadTree();
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(listProductPackages(cached)));
    return true;
  }

  if (request.method === "POST" && url === "/products") {
    try {
      const raw = await readJsonBody(request);
      const withContent = z.object({ id: z.string().min(1), content: z.string().min(1) }).safeParse(raw);
      let result;
      if (withContent.success) {
        result = await createProduct({
          productId: withContent.data.id,
          backgroundContent: withContent.data.content
        });
      } else {
        const body = parseCreateProductInput(raw);
        result = await createProduct({
          productId: body.id,
          backgroundContent: productBackgroundToMarkdown(body.background)
        });
      }
      await respondToWrite(response, result, { status: 201 });
    } catch {
      invalidRequest(response, "Invalid payload.", "Provide id and content or background object.");
    }
    return true;
  }

  const productGet = matchRoute(request, "GET", /^\/products\/([^/]+)$/);
  if (productGet) {
    const id = decodeURIComponent(productGet[1]);
    const cached = await loadTree();
    const pkg = findProductPackage(cached, id);
    if (!pkg) {
      notFound(response, `Product "${id}" not found.`);
      return true;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(pkg));
    return true;
  }

  const productDelete = matchRoute(request, "DELETE", /^\/products\/([^/]+)$/);
  if (productDelete) {
    const id = decodeURIComponent(productDelete[1]);
    const result = await deleteProduct(id);
    if (!result.ok) {
      invalidRequest(response, result.message);
      return true;
    }
    await forceReload();
    response.writeHead(204);
    response.end();
    return true;
  }

  const bgUpload = matchRoute(request, "POST", /^\/products\/([^/]+)\/background\/upload$/);
  if (bgUpload) {
    const productId = decodeURIComponent(bgUpload[1]);
    try {
      const raw = (await readJsonBody(request)) as Record<string, unknown>;
      const body = parseUploadProductBackgroundInput({ ...raw, productId });
      await respondToWrite(
        response,
        await writeProductBackground({
          productId: body.productId,
          content: body.content,
          overwrite: body.overwrite
        })
      );
    } catch {
      invalidRequest(response, "Invalid payload.", "Provide content and optional overwrite.");
    }
    return true;
  }

  const glossaryUpload = matchRoute(request, "POST", /^\/products\/([^/]+)\/glossary\/upload$/);
  if (glossaryUpload) {
    const productId = decodeURIComponent(glossaryUpload[1]);
    try {
      const raw = (await readJsonBody(request)) as Record<string, unknown>;
      const body = parseUploadProductGlossaryInput({ ...raw, productId });
      await respondToWrite(
        response,
        await writeProductGlossary({
          productId: body.productId,
          content: body.content,
          format: body.format,
          overwrite: body.overwrite
        })
      );
    } catch {
      invalidRequest(response, "Invalid payload.", "Provide content, format, and optional overwrite.");
    }
    return true;
  }

  const glossaryDelete = matchRoute(request, "DELETE", /^\/products\/([^/]+)\/glossary$/);
  if (glossaryDelete) {
    const productId = decodeURIComponent(glossaryDelete[1]);
    const result = await deleteProductFile(productId, "glossary");
    if (!result.ok) {
      invalidRequest(response, result.message);
      return true;
    }
    await forceReload();
    response.writeHead(204);
    response.end();
    return true;
  }

  const guideUpload = matchRoute(request, "POST", /^\/products\/([^/]+)\/writing-guide\/upload$/);
  if (guideUpload) {
    const productId = decodeURIComponent(guideUpload[1]);
    try {
      const raw = (await readJsonBody(request)) as Record<string, unknown>;
      const body = parseUploadProductWritingGuideInput({ ...raw, productId });
      await respondToWrite(
        response,
        await writeProductWritingGuide({
          productId: body.productId,
          content: body.content,
          overwrite: body.overwrite
        })
      );
    } catch {
      invalidRequest(response, "Invalid payload.", "Provide content and optional overwrite.");
    }
    return true;
  }

  const guideDelete = matchRoute(request, "DELETE", /^\/products\/([^/]+)\/writing-guide$/);
  if (guideDelete) {
    const productId = decodeURIComponent(guideDelete[1]);
    const result = await deleteProductFile(productId, "writing-guide");
    if (!result.ok) {
      invalidRequest(response, result.message);
      return true;
    }
    await forceReload();
    response.writeHead(204);
    response.end();
    return true;
  }

  // --- Legacy v1 ---
  if (request.method === "GET" && url === "/glossaries") {
    const cached = await loadTree();
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(toLegacyGlossaryList(cached)));
    return true;
  }

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
      await respondToWrite(
        response,
        await writeGuideline({
          filename: legacy.filename,
          content: legacy.content,
          layer,
          productId: legacy.productId ?? legacy.filename.replace(/\.md$/, ""),
          overwrite: legacy.overwrite
        })
      );
    } catch {
      invalidRequest(response, "Invalid upload payload.", "Provide filename, content, and layer or scope.");
    }
    return true;
  }

  if (request.method === "POST" && url === "/glossary/upload") {
    try {
      const body = parseUploadCompanyGlossaryInput(await readJsonBody(request));
      await respondToWrite(
        response,
        await writeGlossary({
          filename: `company-glossary.${body.format}`,
          content: body.content,
          format: body.format,
          overwrite: body.overwrite
        })
      );
    } catch {
      invalidRequest(response, "Invalid upload payload.", "Provide content and format.");
    }
    return true;
  }

  const delGuideline = matchRoute(request, "DELETE", /^\/guidelines\/([^/]+)$/);
  if (delGuideline) {
    const id = decodeURIComponent(delGuideline[1]);
    const cached = await loadTree();
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

  const delGlossary = matchRoute(request, "DELETE", /^\/glossaries\/([^/]+)$/);
  if (delGlossary) {
    const id = decodeURIComponent(delGlossary[1]);
    const cached = await loadTree();
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

  const idMatch = matchRoute(request, "GET", /^\/guidelines\/([^/]+)$/);
  if (idMatch) {
    const id = idMatch[1];
    const cached = await loadTree();
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

  const sourcesMatch = matchRoute(request, "GET", /^\/guidelines\/([^/]+)\/sources$/);
  if (sourcesMatch) {
    const id = sourcesMatch[1];
    const cached = await loadTree();
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

  const snapshotMatch = matchRoute(request, "GET", /^\/guidelines\/([^/]+)\/snapshot$/);
  if (snapshotMatch) {
    const id = snapshotMatch[1];
    const cached = await loadTree();
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
