import { z } from "zod";

import { glossaryTermSchema } from "./project-guidance";

export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  rootPath: z.string().min(1),
  brandVoice: z.string().optional(),
  glossary: z.array(glossaryTermSchema).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
});

export const createProjectInputSchema = z.object({
  name: z.string().min(1),
  rootPath: z.string().min(1)
});

export const projectListSchema = z.object({
  projects: z.array(projectSchema),
  activeProjectId: z.string().min(1).nullable()
});

export type Project = z.infer<typeof projectSchema>;
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
export type ProjectList = z.infer<typeof projectListSchema>;

export function parseProject(payload: unknown): Project {
  return projectSchema.parse(payload);
}

export function parseProjectList(payload: unknown): ProjectList {
  return projectListSchema.parse(payload);
}
