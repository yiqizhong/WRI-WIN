import { z } from "zod";

import { connectionDiagnosticSchema } from "./connection-diagnostic";
import { figmaReviewScopeSchema } from "./figma-scope";

export const figmaTextNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.array(z.string().min(1)),
  characters: z.string(),
  styleHints: z.record(z.string(), z.unknown()).optional(),
  visible: z.boolean().default(true)
});

export const figmaTextExtractionSchema = z.object({
  scope: figmaReviewScopeSchema,
  nodes: z.array(figmaTextNodeSchema),
  warnings: z.array(connectionDiagnosticSchema).default([]),
  extractedAt: z.iso.datetime()
});

export type FigmaTextNode = z.infer<typeof figmaTextNodeSchema>;
export type FigmaTextExtraction = z.infer<typeof figmaTextExtractionSchema>;

export function parseFigmaTextExtraction(payload: unknown): FigmaTextExtraction {
  return figmaTextExtractionSchema.parse(payload);
}
