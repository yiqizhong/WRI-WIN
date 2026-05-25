import type { DesignContext, FigmaReviewScope, ReviewSourceType } from "@writer/contracts";

export type ReviewMode = "clarity" | "tone" | "consistency" | "accessibility" | "full";

export type AssembledReviewContext = {
  sourceType: ReviewSourceType;
  mode: ReviewMode;
  prompt: string;
  chunks: string[];
  metadata: Record<string, unknown>;
};

export type ContextAssemblerInput = {
  sourceType: ReviewSourceType;
  mode?: ReviewMode;
  scope: Record<string, unknown>;
  brandVoice?: string;
  glossary?: string[];
  featureName?: string;
  description?: string;
  designContext?: DesignContext;
  pastedText?: string;
  textNodes?: Array<{ id: string; characters: string; path: string[] }>;
};

const MAX_CHUNK_CHARS = 4000;

export function assembleReviewContext(input: ContextAssemblerInput): AssembledReviewContext {
  const mode = input.mode ?? "full";
  const lines: string[] = [
    `Review mode: ${mode}`,
    `Source type: ${input.sourceType}`
  ];

  if (input.brandVoice) {
    lines.push(`Brand voice: ${input.brandVoice}`);
  }

  if (input.glossary?.length) {
    lines.push(`Glossary: ${input.glossary.join(", ")}`);
  }

  if (input.featureName?.trim()) {
    lines.push(`Feature: ${input.featureName.trim()}`);
  }

  if (input.description?.trim()) {
    lines.push(`Feature description: ${input.description.trim()}`);
  }

  if (input.designContext) {
    lines.push(`Design hierarchy nodes: ${input.designContext.hierarchy.length}`);
    if (input.designContext.flowOrder?.length) {
      lines.push(`Flow order: ${input.designContext.flowOrder.join(" -> ")}`);
    }
  }

  if (input.pastedText) {
    lines.push("Pasted copy:");
    lines.push(input.pastedText);
  }

  if (input.textNodes?.length) {
    lines.push("Figma text nodes:");
    for (const node of input.textNodes) {
      lines.push(`- [${node.id}] ${node.path.join(" / ")}: ${node.characters}`);
    }
  }

  if (input.sourceType === "figma") {
    const scope = input.scope as FigmaReviewScope;
    lines.push(`Figma scope: ${scope.kind} (${JSON.stringify(scope)})`);
  }

  const body = lines.join("\n");
  const chunks = chunkText(body, MAX_CHUNK_CHARS);

  return {
    sourceType: input.sourceType,
    mode,
    prompt: `Review the following UX copy for ${mode} issues. Return structured findings and rewrite candidates.\n\n${body}`,
    chunks,
    metadata: {
      chunkCount: chunks.length,
      scope: input.scope
    }
  };
}

function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let offset = 0;

  while (offset < text.length) {
    chunks.push(text.slice(offset, offset + maxChars));
    offset += maxChars;
  }

  return chunks;
}
