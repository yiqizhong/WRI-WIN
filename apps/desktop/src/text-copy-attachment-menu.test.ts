import { describe, expect, it } from "vitest";

import { attachmentKindFromPath } from "./text-copy-attachment-menu";

describe("attachmentKindFromPath", () => {
  it("detects spreadsheet extensions", () => {
    expect(attachmentKindFromPath("/tmp/copy.csv")).toBe("spreadsheet");
    expect(attachmentKindFromPath("/tmp/copy.xlsx")).toBe("spreadsheet");
  });

  it("detects plain text extensions", () => {
    expect(attachmentKindFromPath("/tmp/notes.md")).toBe("plain_text");
    expect(attachmentKindFromPath("/tmp/notes.txt")).toBe("plain_text");
  });
});
