import {
  isApiError,
  parseAgentAdapterList,
  parseAgentRunResult,
  parseAgentSmokeResult,
  parseDaemonHealth,
  parseDirectoryListing,
  parseDevinProviderSettings,
  parseDevinRuntimeOptions,
  parseGlossaryList,
  parseGuideline,
  parseGuidelineList,
  parseGuidelinesTree,
  parseGuidelineSnapshot,
  parseLocalModelStatusResponse,
  parseProductPackage,
  productPackageSchema,
  parseMcpServerList,
  parseMcpSmokeResult,
  parseParsedFigmaUrl,
  parsePasteTextConversation,
  parsePasteTextMessageResult,
  parseProject,
  parseProjectList,
  parseFigmaGuidelineGenerationResponse,
  parseListPageFramesResponse,
  parseReviewSession,
  parseReviewSessionList,
  parseWorkspaceInfo,
  type CreateFigmaSessionInput,
  type ListPageFramesResponse,
  parsePermissionRequest,
  parseWritebackResult,
  parseSpreadsheetParseResult,
  type AgentRunResult,
  type ChangeStatus,
  type DirectoryListing,
  type DevinRuntimeOptions,
  type GlossaryList,
  type Guideline,
  type GuidelineList,
  type GuidelinesTree,
  type GuidelineSnapshot,
  type LocalModelStatusResponse,
  type ProductPackage,
  type FigmaGuidelineGenerationResponse,
  type ParsedFigmaUrl,
  type PasteTextConversation,
  type PasteTextMessageResult,
  type Project,
  type ProjectList,
  type ReviewChange,
  type ReviewSession,
  type RewriteCandidate,
  type SpreadsheetParseResult,
  type UxCopyFinding
} from "@writer/contracts";

const DEFAULT_BASE_URL = "http://127.0.0.1:47631";

export class DaemonClientError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DaemonClientError";
    this.code = code;
  }
}

function throwDaemonResponseError(response: Response, payload: unknown): never {
  if (isApiError(payload)) {
    const parts = [payload.message];
    if (payload.guidance) {
      parts.push(payload.guidance);
    }
    throw new DaemonClientError(payload.code, parts.join(" "));
  }

  const diagnostic = (payload as {
    diagnostic?: { code?: string; message?: string; recoveryAction?: string };
  }).diagnostic;

  if (diagnostic?.message) {
    const parts = [diagnostic.message];
    if (diagnostic.recoveryAction) {
      parts.push(diagnostic.recoveryAction);
    }
    throw new DaemonClientError(diagnostic.code ?? "service_unavailable", parts.join(" "));
  }

  if (response.status === 404) {
    throw new DaemonClientError(
      "not_found",
      "Daemon API is out of date. Fully quit Writer (Cmd+Q) and reopen the app."
    );
  }

  throw new DaemonClientError("service_unavailable", `Daemon returned HTTP ${response.status}`);
}

function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 60_000): Promise<Response> {
  if (timeoutMs <= 0) {
    return fetch(url, init);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(
      new DOMException(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`, "TimeoutError")
    );
  }, timeoutMs);

  return fetch(url, { ...init, signal: controller.signal })
    .catch((error: unknown) => {
      if (error instanceof Error && error.name === "AbortError") {
        const seconds = Math.round(timeoutMs / 1000);
        throw new DaemonClientError(
          "timeout",
          `The request took longer than ${seconds} seconds and was cancelled. If you were generating guidelines, wait and try again — Devin analysis can take several minutes.`
        );
      }
      throw error;
    })
    .finally(() => clearTimeout(timer));
}

async function moduleRequest<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
  parse?: (payload: unknown) => T,
  timeoutMs = 60_000,
  authHeaders: Record<string, string> = {}
): Promise<T> {
  const response = await fetchWithTimeout(
    `${baseUrl}${path}`,
    { ...init, headers: { ...authHeaders, ...init?.headers } },
    timeoutMs
  );
  const payload: unknown = await response.json();

  if (!response.ok) {
    throwDaemonResponseError(response, payload);
  }

  return parse ? parse(payload) : (payload as T);
}

async function moduleDeleteRequest(
  baseUrl: string,
  path: string,
  authHeaders: Record<string, string> = {}
): Promise<void> {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, { method: "DELETE", headers: authHeaders });
  if (response.ok) {
    return;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // 204/empty body or non-JSON error page
  }

  if (isApiError(payload)) {
    throw new DaemonClientError(payload.code, payload.message);
  }

  throw new DaemonClientError("service_unavailable", `Delete failed: HTTP ${response.status}`);
}

export type ReviewQueue = {
  findings: UxCopyFinding[];
  rewrites: RewriteCandidate[];
  changes: ReviewChange[];
  diagnostic?: import("@writer/contracts").ConnectionDiagnostic;
};

export function createDaemonClient(baseUrl = DEFAULT_BASE_URL, token = "") {
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  // Local wrappers that thread the auth header into every request without
  // touching each call site. They shadow the module-level helpers below.
  const request = <T>(
    base: string,
    path: string,
    init?: RequestInit,
    parse?: (payload: unknown) => T,
    timeoutMs?: number
  ): Promise<T> => moduleRequest(base, path, init, parse, timeoutMs ?? 60_000, authHeaders);
  const deleteRequest = (base: string, path: string): Promise<void> =>
    moduleDeleteRequest(base, path, authHeaders);

  // Append the bearer token as a ?token= query param for URLs that can't carry
  // an Authorization header (e.g. <img src> screenshots, template downloads).
  const withToken = (url: string): string => {
    if (!token) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}token=${encodeURIComponent(token)}`;
  };

  return {
    getHealth: () => request(baseUrl, "/health", undefined, parseDaemonHealth),

    listProjects: () => request(baseUrl, "/projects", undefined, parseProjectList),

    getWorkspace: () => request(baseUrl, "/workspace", undefined, parseWorkspaceInfo),

    openProject: (input: { name: string; rootPath: string }) =>
      request(
        baseUrl,
        "/projects",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input)
        },
        parseProject
      ),

    updateProjectGuidance: (input: {
      projectId: string;
      brandVoice?: string;
      glossary?: Array<{ term: string; preferred?: string; avoid?: string }>;
    }) =>
      request(
        baseUrl,
        "/projects/guidance",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input)
        },
        parseProject
      ),

    listDirectory: (folderPath: string) =>
      request(
        baseUrl,
        "/filesystem/list",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path: folderPath })
        },
        parseDirectoryListing
      ),

    parseFigmaUrl: (url: string) =>
      request(
        baseUrl,
        "/figma/parse-url",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url })
        },
        parseParsedFigmaUrl
      ),

    listPageFrames: (pageUrl: string) =>
      request(
        baseUrl,
        "/figma/list-page-frames",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pageUrl })
        },
        parseListPageFramesResponse
      ),

    listSessions: (projectId: string) =>
      request(
        baseUrl,
        `/sessions?projectId=${encodeURIComponent(projectId)}`,
        undefined,
        parseReviewSessionList
      ),

    getSession: (sessionId: string) =>
      request(baseUrl, `/sessions/${encodeURIComponent(sessionId)}`, undefined, parseReviewSession),

    sessionScreenshotUrl: (sessionId: string, frameId: string) =>
      withToken(
        `${baseUrl}/sessions/${encodeURIComponent(sessionId)}/screenshots/${encodeURIComponent(frameId.replace(/:/g, "-"))}`
      ),

    createPastedTextSession: (input: { projectId: string; productId: string; text: string }) =>
      request(
        baseUrl,
        "/sessions/pasted-text",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input)
        },
        parseReviewSession
      ),

    createSession: (input: {
      projectId: string;
      productId?: string;
      sourceType: string;
      scope: Record<string, unknown>;
    }) =>
      request(
        baseUrl,
        "/sessions",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input)
        },
        parseReviewSession
      ),

    runAudit: (sessionId: string) =>
      request<ReviewQueue>(baseUrl, "/review/audit/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId })
      }),

    getReviewQueue: (sessionId: string) =>
      request<ReviewQueue>(baseUrl, `/review/queue?sessionId=${encodeURIComponent(sessionId)}`),

    transitionChange: (input: { changeId: string; nextStatus: ChangeStatus; after?: string }) =>
      request<ReviewChange>(baseUrl, "/review/changes/transition", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...input, actor: "user" })
      }),

    bulkTransition: (input: { changeIds: string[]; nextStatus: "approved" | "rejected" | "skipped" }) =>
      request<{ changes: ReviewChange[] }>(baseUrl, "/review/changes/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...input, actor: "user" })
      }),

    runFigmaWriteback: (input: {
      sessionId: string;
      changeIds: string[];
      permissionRequestId?: string;
    }) =>
      request(
        baseUrl,
        "/figma/writeback",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input)
        },
        parseWritebackResult
      ),

    decidePermission: (input: { requestId: string; decision: "approved" | "denied" }) =>
      request(
        baseUrl,
        "/permissions/decisions",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input)
        },
        parsePermissionRequest
      ),

    parseSpreadsheet: (filePath: string) =>
      request(
        baseUrl,
        "/spreadsheet/parse",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ filePath })
        },
        parseSpreadsheetParseResult
      ),

    exportMarkdown: async (sessionId: string) => {
      const response = await fetch(
        `${baseUrl}/review/export/markdown?sessionId=${encodeURIComponent(sessionId)}`,
        { headers: authHeaders }
      );
      if (!response.ok) {
        throw new DaemonClientError("service_unavailable", "Markdown export failed.");
      }
      return response.text();
    },

    exportJson: (sessionId: string) =>
      request<Record<string, unknown>>(
        baseUrl,
        `/review/export/json?sessionId=${encodeURIComponent(sessionId)}`
      ),

    getChangelog: (sessionId: string) =>
      request<{ entries: Array<{ summary: string; timestamp: string }> }>(
        baseUrl,
        `/review/changelog?sessionId=${encodeURIComponent(sessionId)}`
      ),

    createFigmaSession: (input: CreateFigmaSessionInput) =>
      request(
        baseUrl,
        "/sessions/figma",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input)
        },
        parseReviewSession
      ),

    generateFigmaGuideline: (input: { sessionId: string; adapterId?: string; maxCandidates?: number }) =>
      request(
        baseUrl,
        "/guidelines/generate/figma",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input)
        },
        parseFigmaGuidelineGenerationResponse,
        0
      ) as Promise<FigmaGuidelineGenerationResponse>,

    abandonFigmaGuidelineGeneration: (input: { sessionId: string; message?: string }) =>
      request<{ ok: true; sessionId: string }>(baseUrl, "/guidelines/generate/figma/abandon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      }),

    exportSpreadsheet: (input: { sessionId: string; outputPath: string; mapping?: Record<string, unknown> }) =>
      request<{ outputPath: string; rowCount: number }>(baseUrl, "/spreadsheet/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      }),

    exportHtml: async (sessionId: string) => {
      const response = await fetch(
        `${baseUrl}/review/export/html?sessionId=${encodeURIComponent(sessionId)}`,
        { headers: authHeaders }
      );
      if (!response.ok) {
        throw new DaemonClientError("service_unavailable", "HTML export failed.");
      }
      return response.text();
    },

    listAgents: () => request(baseUrl, "/agents", undefined, parseAgentAdapterList),

    refreshAgents: () =>
      request(
        baseUrl,
        "/agents/detect",
        { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
        parseAgentAdapterList
      ),

    smokeAgent: (adapterId: string) =>
      request(
        baseUrl,
        "/agents/smoke",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ adapterId })
        },
        parseAgentSmokeResult,
        90_000
      ),

    setActiveAdapter: (adapterId: string) =>
      request(
        baseUrl,
        "/agents/active",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ adapterId })
        },
        parseAgentAdapterList
      ),

    getDevinProviderSettings: () =>
      request(baseUrl, "/agents/providers/devin", undefined, parseDevinProviderSettings),

    getDevinProviderOptions: () =>
      request<DevinRuntimeOptions>(
        baseUrl,
        "/agents/providers/devin/options",
        undefined,
        parseDevinRuntimeOptions
      ),

    updateDevinProviderSettings: (input: {
      modelId?: string;
      reasoningPreference?: "off" | "low" | "medium" | "high";
    }) =>
      request(
        baseUrl,
        "/agents/providers/devin",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input)
        },
        parseDevinProviderSettings
      ),

    getAgentRun: (runId: string) =>
      request(baseUrl, `/agents/runs/${runId}`, undefined, parseAgentRunResult) as Promise<AgentRunResult>,

    listMcpServers: () => request(baseUrl, "/mcp/servers", undefined, parseMcpServerList),

    smokeFigmaRead: () => request(baseUrl, "/mcp/smoke/figma/read", undefined, parseMcpSmokeResult, 90_000),

    startFigmaMcpAuth: () =>
      request(
        baseUrl,
        "/mcp/servers/figma/auth/start",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}"
        },
        undefined,
        120_000
      ) as Promise<{
        ok: boolean;
        status: "connected" | "redirect" | "error";
        authorizationUrl?: string;
        diagnostic?: import("@writer/contracts").ConnectionDiagnostic;
      }>,

    setMcpServerEnabled: async (serverId: string, enabled: boolean) => {
      await request(
        baseUrl,
        `/mcp/servers/${serverId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled })
        }
      );
      return request(baseUrl, "/mcp/servers", undefined, parseMcpServerList);
    },

    attachPasteTextFile: (input: { conversationId: string; filePath: string }) =>
      request(
        baseUrl,
        "/paste-text/attachments",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input)
        },
        (payload) => parsePasteTextConversation((payload as { conversation: unknown }).conversation),
        60_000
      ) as Promise<PasteTextConversation>,

    createPasteTextConversation: (input: {
      projectId: string;
      productId?: string;
      backgroundContext?: string;
    }) =>
      request(
        baseUrl,
        "/paste-text/conversations",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input)
        },
        (payload) => parsePasteTextConversation((payload as { conversation: unknown }).conversation),
        60_000
      ) as Promise<PasteTextConversation>,

    getPasteTextConversation: (conversationId: string) =>
      request(
        baseUrl,
        `/paste-text/conversations/${encodeURIComponent(conversationId)}`,
        undefined,
        (payload) => parsePasteTextConversation((payload as { conversation: unknown }).conversation),
        60_000
      ) as Promise<PasteTextConversation>,

    sendPasteTextMessage: (conversationId: string, input: { text: string; rowIndex?: number }) =>
      request(
        baseUrl,
        `/paste-text/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input)
        },
        parsePasteTextMessageResult,
        120_000
      ) as Promise<PasteTextMessageResult>,

    regeneratePasteTextAssistantMessage: (
      conversationId: string,
      assistantMessageId: string,
      input?: { adapterId?: string }
    ) =>
      request(
        baseUrl,
        `/paste-text/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(assistantMessageId)}/regenerate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input ?? {})
        },
        (payload) => parsePasteTextConversation((payload as { conversation: unknown }).conversation),
        120_000
      ) as Promise<PasteTextConversation>,

    getGuidelinesTree: () => request(baseUrl, "/guidelines", undefined, parseGuidelinesTree),

    /** @deprecated use getGuidelinesTree */
    listGuidelines: () => request(baseUrl, "/guidelines", undefined, parseGuidelineList),

    getCompanyBase: () =>
      request(baseUrl, "/company-base", undefined, (p) => (p === null ? null : parseGuideline(p))),

    uploadCompanyBase: (input: { content: string; overwrite?: boolean; sourceFilename?: string }) =>
      request<{ ok: boolean; filePath: string }>(baseUrl, "/company-base/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      }),

    deleteCompanyBase: () => deleteRequest(baseUrl, "/company-base"),

    getSoftwareWriting: () =>
      request(baseUrl, "/software-writing", undefined, (p) => (p === null ? null : parseGuideline(p))),

    uploadSoftwareWriting: (input: { content: string; overwrite?: boolean; sourceFilename?: string }) =>
      request<{ ok: boolean; filePath: string }>(baseUrl, "/software-writing/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      }),

    deleteSoftwareWriting: () => deleteRequest(baseUrl, "/software-writing"),

    getCompanyGlossary: () =>
      request(baseUrl, "/company-glossary", undefined, (p) => (p as import("@writer/contracts").Term[] | null)),

    uploadCompanyGlossary: (input: { content: string; format: "csv" | "md"; overwrite?: boolean }) =>
      request<{ ok: boolean; filePath: string }>(baseUrl, "/company-glossary/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      }),

    deleteCompanyGlossary: () => deleteRequest(baseUrl, "/company-glossary"),

    listProducts: () =>
      request(baseUrl, "/products", undefined, (p) => productPackageSchema.array().parse(p)),

    getProduct: (id: string) =>
      request(baseUrl, `/products/${encodeURIComponent(id)}`, undefined, parseProductPackage),

    createProduct: (input: {
      id: string;
      content?: string;
      files?: Array<{ filename: string; content: string }>;
    }) =>
      request<{ ok: boolean; filePath: string }>(baseUrl, "/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      }),

    deleteProduct: (id: string) => deleteRequest(baseUrl, `/products/${encodeURIComponent(id)}`),

    uploadProductBackground: (
      productId: string,
      input: { content: string; overwrite?: boolean; sourceFilename?: string }
    ) =>
      request<{ ok: boolean; filePath: string }>(
        baseUrl,
        `/products/${encodeURIComponent(productId)}/background/upload`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input)
        }
      ),

    deleteProductBackground: (productId: string) =>
      deleteRequest(baseUrl, `/products/${encodeURIComponent(productId)}/background`),

    uploadProductGlossary: (
      productId: string,
      input: { content: string; format: "csv" | "md"; overwrite?: boolean; sourceFilename?: string }
    ) =>
      request<{ ok: boolean; filePath: string }>(
        baseUrl,
        `/products/${encodeURIComponent(productId)}/glossary/upload`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input)
        }
      ),

    deleteProductGlossary: (productId: string) =>
      deleteRequest(baseUrl, `/products/${encodeURIComponent(productId)}/glossary`),

    uploadProductWritingGuide: (
      productId: string,
      input: { content: string; overwrite?: boolean; sourceFilename?: string }
    ) =>
      request<{ ok: boolean; filePath: string }>(
        baseUrl,
        `/products/${encodeURIComponent(productId)}/writing-guide/upload`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input)
        }
      ),

    uploadProductFile: (
      productId: string,
      input: { filename: string; content: string; overwrite?: boolean }
    ) =>
      request<{ ok: boolean; filePath: string }>(
        baseUrl,
        `/products/${encodeURIComponent(productId)}/files/upload`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input)
        }
      ),

    deleteProductWritingGuide: (productId: string) =>
      deleteRequest(baseUrl, `/products/${encodeURIComponent(productId)}/writing-guide`),

    listGlossaries: () => request(baseUrl, "/glossaries", undefined, parseGlossaryList),

    reloadGuidelines: () =>
      request(baseUrl, "/guidelines/reload", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),

    getGuidelineSnapshot: (id: string) =>
      request(baseUrl, `/guidelines/${encodeURIComponent(id)}/snapshot`, undefined, parseGuidelineSnapshot),

    uploadGuideline: (input: {
      filename: string;
      content: string;
      scope?: "company" | "product";
      layer?: "company-base" | "software-writing" | "product-writing";
      productId?: string;
      overwrite?: boolean;
    }) =>
      request<{ ok: boolean; filePath: string }>(baseUrl, "/guidelines/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      }),

    uploadGlossary: (input: {
      filename: string;
      content: string;
      format: "csv" | "md";
      overwrite?: boolean;
    }) =>
      request<{ ok: boolean; filePath: string }>(baseUrl, "/glossary/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      }),

    deleteGuideline: (id: string) =>
      fetchWithTimeout(`${baseUrl}/guidelines/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeaders }).then((r) => {
        if (!r.ok) throw new DaemonClientError("service_unavailable", `Delete failed: HTTP ${r.status}`);
      }),

    deleteGlossary: (id: string) =>
      fetchWithTimeout(`${baseUrl}/glossaries/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeaders }).then((r) => {
        if (!r.ok) throw new DaemonClientError("service_unavailable", `Delete failed: HTTP ${r.status}`);
      }),

    setActiveProductId: (projectId: string, productId: string | null) =>
      request(
        baseUrl,
        `/projects/${encodeURIComponent(projectId)}/product`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productId })
        },
        parseProject
      ),

    /** @deprecated use setActiveProductId */
    setActiveGuidelineId: (projectId: string, guidelineId: string | null) =>
      request(
        baseUrl,
        `/projects/${encodeURIComponent(projectId)}/guideline`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ guidelineId })
        },
        parseProject
      ),

    companyBaseTemplateUrl: () => withToken(`${baseUrl}/guidelines/templates/company-base.md`),
    softwareWritingTemplateUrl: () => withToken(`${baseUrl}/guidelines/templates/software-writing.md`),
    productBackgroundTemplateUrl: () => withToken(`${baseUrl}/guidelines/templates/product-background.md`),
    productWritingGuideTemplateUrl: () => withToken(`${baseUrl}/guidelines/templates/product-writing-guide.md`),
    glossaryTemplateUrl: () => withToken(`${baseUrl}/guidelines/templates/glossary.csv`),
    /** @deprecated */
    guidelineTemplateUrl: () => withToken(`${baseUrl}/guidelines/templates/guideline.md`),

    getLocalModelStatus: (): Promise<LocalModelStatusResponse> =>
      request(baseUrl, "/local-models", undefined, parseLocalModelStatusResponse),

    startLocalModelDownload: (): Promise<{ started: boolean }> =>
      request(
        baseUrl,
        "/local-models/download",
        { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
        undefined
      ) as Promise<{ started: boolean }>,

    resetLocalModel: (): Promise<LocalModelStatusResponse> =>
      request(
        baseUrl,
        "/local-models/reset",
        { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
        parseLocalModelStatusResponse
      ),

    getDraftModelStatus: (): Promise<{ installed: boolean; enabled: boolean; lastError?: string }> =>
      request(
        baseUrl,
        "/local-model/draft/status",
        undefined,
        undefined
      ) as Promise<{ installed: boolean; enabled: boolean; lastError?: string }>,

    installDraftModel: (): Promise<{ installed: boolean; reason?: string; path?: string }> =>
      request(
        baseUrl,
        "/local-model/draft/install",
        { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
        undefined
      ) as Promise<{ installed: boolean; reason?: string; path?: string }>,

    setDraftModelEnabled: (enabled: boolean): Promise<{ ok: boolean; enabled: boolean }> =>
      request(
        baseUrl,
        "/local-model/draft/enabled",
        { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled }) },
        undefined
      ) as Promise<{ ok: boolean; enabled: boolean }>
  };
}

export type DaemonClient = ReturnType<typeof createDaemonClient>;
export type {
  AgentRunResult,
  DirectoryListing,
  GlossaryList,
  Guideline,
  GuidelineList,
  GuidelinesTree,
  GuidelineSnapshot,
  ParsedFigmaUrl,
  PasteTextConversation,
  PasteTextMessageResult,
  ProductPackage,
  Project,
  ProjectList,
  ReviewSession,
  SpreadsheetParseResult
};
