import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import type { DirectoryListing } from "@writer/contracts";

export async function listDirectory(targetPath: string): Promise<DirectoryListing> {
  const resolved = path.resolve(targetPath);
  const dirStat = await stat(resolved);

  if (!dirStat.isDirectory()) {
    throw new Error("Path is not a directory");
  }

  const names = await readdir(resolved);
  const entries = await Promise.all(
    names.map(async (name) => {
      const entryPath = path.join(resolved, name);
      const entryStat = await stat(entryPath);

      return {
        name,
        path: entryPath,
        type: entryStat.isDirectory() ? ("directory" as const) : ("file" as const)
      };
    })
  );

  entries.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return { path: resolved, entries };
}
