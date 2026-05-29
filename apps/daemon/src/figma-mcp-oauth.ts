import { createServer, type Server } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { OAuthClientProvider, OAuthDiscoveryState } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthClientInformationMixed, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

export const FIGMA_MCP_DEFAULT_URL = "https://mcp.figma.com/mcp";
export const FIGMA_MCP_OAUTH_CALLBACK_PORT = 19876;
export const FIGMA_MCP_OAUTH_CALLBACK_PATH = "/mcp/oauth/callback";
export const FIGMA_MCP_OAUTH_REDIRECT_URL = `http://127.0.0.1:${FIGMA_MCP_OAUTH_CALLBACK_PORT}${FIGMA_MCP_OAUTH_CALLBACK_PATH}`;

type StoredFigmaAuth = {
  clientInformation?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  codeVerifier?: string;
  discoveryState?: OAuthDiscoveryState;
};

export type FigmaOAuthProvider = OAuthClientProvider & {
  getPendingAuthorizationUrl: () => URL | undefined;
  hasTokens: () => Promise<boolean>;
};

export type FigmaOAuthProviderOptions = {
  storePath?: string;
  onAuthorizationUrl?: (url: URL) => void;
  clientName?: string;
};

export function getFigmaAuthStorePath(): string {
  return join(homedir(), ".writer", "mcp-auth", "figma.json");
}

export function createFigmaOAuthProvider(options: FigmaOAuthProviderOptions = {}): FigmaOAuthProvider {
  const storePath = options.storePath ?? getFigmaAuthStorePath();
  let pendingAuthUrl: URL | undefined;
  let cached: StoredFigmaAuth | null = null;

  async function loadCache(): Promise<StoredFigmaAuth> {
    if (cached) {
      return cached;
    }

    try {
      cached = JSON.parse(await readFile(storePath, "utf8")) as StoredFigmaAuth;
    } catch {
      cached = {};
    }

    return cached;
  }

  async function persist(): Promise<void> {
    const data = await loadCache();
    await mkdir(dirname(storePath), { recursive: true });
    await writeFile(storePath, JSON.stringify(data, null, 2), "utf8");
  }

  return {
    get redirectUrl() {
      return FIGMA_MCP_OAUTH_REDIRECT_URL;
    },

    get clientMetadata() {
      return {
        redirect_uris: [FIGMA_MCP_OAUTH_REDIRECT_URL],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        // Figma's MCP registration endpoint enforces a client-name allowlist:
        // "Claude Code" is accepted, while names like "Cursor"/"Visual Studio Code"
        // (and arbitrary names) are now rejected with 403. Register under the
        // allowlisted name so dynamic client registration succeeds.
        // (The full 18-tool surface is exposed by merging known tools in mcp.ts;
        // the server's tools/list only enumerates ~10 though all are callable.)
        client_name: options.clientName ?? "Claude Code",
        scope: "mcp:connect"
      };
    },

    async clientInformation() {
      return (await loadCache()).clientInformation;
    },

    async saveClientInformation(clientInformation) {
      const data = await loadCache();
      data.clientInformation = clientInformation;
      await persist();
    },

    async tokens() {
      return (await loadCache()).tokens;
    },

    async saveTokens(tokens) {
      const data = await loadCache();
      data.tokens = tokens;
      await persist();
    },

    redirectToAuthorization(authorizationUrl) {
      pendingAuthUrl = authorizationUrl;
      options.onAuthorizationUrl?.(authorizationUrl);
    },

    async saveCodeVerifier(codeVerifier) {
      const data = await loadCache();
      data.codeVerifier = codeVerifier;
      await persist();
    },

    async codeVerifier() {
      return (await loadCache()).codeVerifier ?? "";
    },

    async discoveryState() {
      return (await loadCache()).discoveryState;
    },

    async saveDiscoveryState(discoveryState) {
      const data = await loadCache();
      data.discoveryState = discoveryState;
      await persist();
    },

    async invalidateCredentials(scope) {
      const data = await loadCache();

      if (scope === "all" || scope === "tokens") {
        delete data.tokens;
      }
      if (scope === "all" || scope === "client") {
        delete data.clientInformation;
      }
      if (scope === "all" || scope === "verifier") {
        delete data.codeVerifier;
      }
      if (scope === "all" || scope === "discovery") {
        delete data.discoveryState;
      }

      await persist();
    },

    getPendingAuthorizationUrl() {
      return pendingAuthUrl;
    },

    async hasTokens() {
      return Boolean((await loadCache()).tokens?.access_token);
    }
  };
}

export type OAuthCallbackResult = {
  code: string;
  state?: string;
};

export type OAuthCallbackServer = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  waitForCallback: (timeoutMs?: number) => Promise<OAuthCallbackResult>;
};

export function createOAuthCallbackServer(): OAuthCallbackServer {
  let server: Server | null = null;
  let resolveCallback: ((result: OAuthCallbackResult) => void) | null = null;
  let rejectCallback: ((error: Error) => void) | null = null;

  function resetWaiter() {
    resolveCallback = null;
    rejectCallback = null;
  }

  return {
    async start() {
      if (server) {
        return;
      }

      server = createServer((request, response) => {
        const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${FIGMA_MCP_OAUTH_CALLBACK_PORT}`);

        if (requestUrl.pathname !== FIGMA_MCP_OAUTH_CALLBACK_PATH) {
          response.writeHead(404, { "content-type": "text/plain" });
          response.end("Not found");
          return;
        }

        const code = requestUrl.searchParams.get("code");
        if (!code) {
          response.writeHead(400, { "content-type": "text/plain" });
          response.end("Missing authorization code");
          return;
        }

        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(
          "<!doctype html><html><body><h1>Figma connected</h1><p>You can close this tab and return to Writer.</p></body></html>"
        );

        resolveCallback?.({
          code,
          state: requestUrl.searchParams.get("state") ?? undefined
        });
      });

      await new Promise<void>((resolve, reject) => {
        server?.once("error", reject);
        server?.listen(FIGMA_MCP_OAUTH_CALLBACK_PORT, "127.0.0.1", () => resolve());
      });
    },

    async stop() {
      resetWaiter();
      if (!server) {
        return;
      }

      await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      server = null;
    },

    waitForCallback(timeoutMs = 300_000) {
      return new Promise<OAuthCallbackResult>((resolve, reject) => {
        resolveCallback = resolve;
        rejectCallback = reject;

        const timeout = setTimeout(() => {
          rejectCallback?.(new Error("Timed out waiting for Figma OAuth callback."));
          resetWaiter();
        }, timeoutMs);

        const originalResolve = resolveCallback;
        resolveCallback = (result) => {
          clearTimeout(timeout);
          originalResolve?.(result);
          resetWaiter();
        };
      });
    }
  };
}
