import { z } from "zod";

export const glossaryTermSchema = z.object({
  term: z.string().min(1),
  preferred: z.string().min(1).optional(),
  avoid: z.string().min(1).optional()
});

export const projectGuidanceSchema = z.object({
  brandVoice: z.string().optional(),
  glossary: z.array(glossaryTermSchema).default([])
});

export const updateProjectGuidanceInputSchema = z.object({
  projectId: z.string().min(1),
  brandVoice: z.string().optional(),
  glossary: z.array(glossaryTermSchema).optional()
});

export type GlossaryTerm = z.infer<typeof glossaryTermSchema>;
export type ProjectGuidance = z.infer<typeof projectGuidanceSchema>;
export type UpdateProjectGuidanceInput = z.infer<typeof updateProjectGuidanceInputSchema>;
