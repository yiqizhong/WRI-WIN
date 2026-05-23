import { z } from "zod";

export const filesystemEntryTypeSchema = z.enum(["file", "directory"]);

export const filesystemEntrySchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  type: filesystemEntryTypeSchema
});

export const listDirectoryInputSchema = z.object({
  path: z.string().min(1)
});

export const directoryListingSchema = z.object({
  path: z.string().min(1),
  entries: z.array(filesystemEntrySchema)
});

export type FilesystemEntryType = z.infer<typeof filesystemEntryTypeSchema>;
export type FilesystemEntry = z.infer<typeof filesystemEntrySchema>;
export type ListDirectoryInput = z.infer<typeof listDirectoryInputSchema>;
export type DirectoryListing = z.infer<typeof directoryListingSchema>;

export function parseDirectoryListing(payload: unknown): DirectoryListing {
  return directoryListingSchema.parse(payload);
}

export function parseListDirectoryInput(payload: unknown): ListDirectoryInput {
  return listDirectoryInputSchema.parse(payload);
}
