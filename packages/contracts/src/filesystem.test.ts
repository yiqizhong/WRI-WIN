import { describe, expect, it } from "vitest";

import { parseDirectoryListing } from "./filesystem";

describe("filesystem contract", () => {
  it("accepts directory listings", () => {
    const listing = parseDirectoryListing({
      path: "/tmp/project",
      entries: [{ name: "docs", path: "/tmp/project/docs", type: "directory" }]
    });

    expect(listing.entries[0]?.type).toBe("directory");
  });
});
