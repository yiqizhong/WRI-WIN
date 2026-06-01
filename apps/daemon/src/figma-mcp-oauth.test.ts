import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createFigmaOAuthProvider, FIGMA_MCP_OAUTH_REDIRECT_URL } from "./figma-mcp-oauth";

describe("figma oauth provider", () => {
  it("stores client information and tokens on disk", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "writer-figma-oauth-"));
    const storePath = join(dataDir, "figma.json");
    const provider = createFigmaOAuthProvider({ storePath });

    expect(provider.redirectUrl).toBe(FIGMA_MCP_OAUTH_REDIRECT_URL);
    // Figma's OAuth allowlist only accepts the bare "Claude Code" client name.
    expect(provider.clientMetadata.client_name).toBe("Claude Code");

    await provider.saveClientInformation!({ client_id: "client-123" });
    await provider.saveTokens({ access_token: "access", token_type: "Bearer" });

    const reloaded = createFigmaOAuthProvider({ storePath });
    expect(await reloaded.clientInformation()).toEqual({ client_id: "client-123" });
    expect(await reloaded.tokens()).toEqual({ access_token: "access", token_type: "Bearer" });
    expect(await reloaded.hasTokens()).toBe(true);

    const raw = JSON.parse(await readFile(storePath, "utf8")) as Record<string, unknown>;
    expect(raw.clientInformation).toEqual({ client_id: "client-123" });
    expect(raw.tokens).toEqual({ access_token: "access", token_type: "Bearer" });
  });
});
