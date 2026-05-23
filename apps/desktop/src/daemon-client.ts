import {
  isApiError,
  parseDaemonHealth,
  parseDirectoryListing,
  parseProject,
  parseProjectList,
  type DirectoryListing,
  type Project,
  type ProjectList
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
      )
  };
}

export type DaemonClient = ReturnType<typeof createDaemonClient>;
export type { DirectoryListing, Project, ProjectList };
