export type FigmaScannedTextNode = {
  id: string;
  name: string;
  characters: string;
  path: string[];
  visible: boolean;
};

/**
 * Traverse the entire subtree of `rootId` via the Figma plugin API and return
 * every TEXT node, including those nested inside INSTANCE children that the
 * get_metadata XML omits.
 */
export function buildFigmaFrameTextScanScript(rootId: string): string {
  return `
const rootId = ${JSON.stringify(rootId)};
const root = await figma.getNodeByIdAsync(rootId);
const texts = [];
function walk(n, path) {
  if (n.type === "TEXT") {
    texts.push({ id: n.id, name: n.name, characters: n.characters, path: path.concat(n.name), visible: n.visible !== false });
  }
  if ("children" in n) {
    for (const child of n.children) {
      walk(child, path.concat(n.name));
    }
  }
}
if (root) walk(root, []);
return { texts };
`.trim();
}

export function parseFigmaFrameTextScanResult(payloadText: string): FigmaScannedTextNode[] {
  try {
    const parsed = JSON.parse(payloadText) as { texts?: unknown[] };
    if (!Array.isArray(parsed.texts)) return [];
    return parsed.texts.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const t = item as Record<string, unknown>;
      if (typeof t.id !== "string" || typeof t.name !== "string" || typeof t.characters !== "string") return [];
      const path = Array.isArray(t.path) ? t.path.filter((p): p is string => typeof p === "string") : [];
      return [{ id: t.id, name: t.name, characters: t.characters, path, visible: t.visible !== false }];
    });
  } catch {
    return [];
  }
}

export function buildFigmaTextReadScript(nodeId: string): string {
  return `
const nodeId = ${JSON.stringify(nodeId)};
const node = await figma.getNodeByIdAsync(nodeId);
if (!node || node.type !== "TEXT") {
  throw new Error("Target node is not TEXT: " + nodeId);
}
return { nodeId: node.id, characters: node.characters };
`.trim();
}

export function parseFigmaTextReadResult(payloadText: string): { nodeId: string; characters: string } | null {
  try {
    const parsed = JSON.parse(payloadText) as { nodeId?: string; characters?: string };

    if (typeof parsed.characters !== "string") {
      return null;
    }

    return {
      nodeId: typeof parsed.nodeId === "string" ? parsed.nodeId : "",
      characters: parsed.characters
    };
  } catch {
    return null;
  }
}
