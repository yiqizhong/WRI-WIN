import {
  isApiError,
  parseAgentAdapterList,
  parseDaemonHealth,
  parseDirectoryListing,
  parseMcpServerList,
  parseParsedFigmaUrl,
  parseProject,
  parseProjectList,
  parseReviewSession,
  parseSpreadsheetParseResult,
  type ChangeStatus,
  type DirectoryListing,
  type ParsedFigmaUrl,
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

async function request<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
  parse?: (payload: unknown) => T
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const payload: unknown = await response.json();

  if (!response.ok) {
    if (isApiError(payload)) {
      throw new DaemonClientError(payload.code, payload.message);
    }

    throw new DaemonClientError("service_unavailable", `Daemon returned HTTP ${response.status}`);
  }

  return parse ? parse(payload) : (payload as T);
}

export type ReviewQueue = {
  findings: UxCopyFinding[];
  rewrites: RewriteCandidate[];
  changes: ReviewChange[];
};

export function createDaemonClient(baseUrl = DEFAULT_BASE_URL) {
  return {
    getHealth: () => request(baseUrl, "/health", undefined, parseDaemonHealth),

    listProjects: () => request(baseUrl, "/projects", undefined, parseProjectList),

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

    createPastedTextSession: (input: { projectId: string; text: string }) =>
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

    createSession: (input: { projectId: string; sourceType: string; scope: Record<string, unknown> }) =>
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
        `${baseUrl}/review/export/markdown?sessionId=${encodeURIComponent(sessionId)}`
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

    createFigmaSession: (input: { projectId: string; url: string }) =>
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

    exportSpreadsheet: (input: { sessionId: string; outputPath: string; mapping?: Record<string, unknown> }) =>
      request<{ outputPath: string; rowCount: number }>(baseUrl, "/spreadsheet/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      }),

    exportHtml: async (sessionId: string) => {
      const response = await fetch(
        `${baseUrl}/review/export/html?sessionId=${encodeURIComponent(sessionId)}`
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
      request<{ ok: boolean; adapterId: string; output?: string; message?: string }>(
        baseUrl,
        "/agents/smoke",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ adapterId })
        }
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

    listMcpServers: () => request(baseUrl, "/mcp/servers", undefined, parseMcpServerList),

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
    }
  };
}

export type DaemonClient = ReturnType<typeof createDaemonClient>;
export type { DirectoryListing, ParsedFigmaUrl, Project, ProjectList, ReviewSession, SpreadsheetParseResult };
