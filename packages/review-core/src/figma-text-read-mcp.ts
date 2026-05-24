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
