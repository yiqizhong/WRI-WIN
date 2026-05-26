import { describe, expect, it } from "vitest";
import type { PasteTextMessage } from "@writer/contracts";

import {
  getMessageVariants,
  messageVariantText,
  resolveVariantIndex
} from "./message-display";

function assistantMessage(partial: Partial<PasteTextMessage> = {}): PasteTextMessage {
  return {
    id: "a1",
    role: "assistant",
    text: "fallback",
    createdAt: "2026-05-25T00:00:00.000Z",
    ...partial
  };
}

describe("message variants", () => {
  it("reads variants from message payload", () => {
    const message = assistantMessage({
      status: "complete",
      variants: ["first", "second"],
      variantIndex: 1
    });

    expect(getMessageVariants(message)).toEqual(["first", "second"]);
    expect(resolveVariantIndex(message)).toBe(1);
    expect(messageVariantText(message)).toBe("second");
  });

  it("falls back to suggestedText for legacy messages", () => {
    const message = assistantMessage({
      status: "complete",
      suggestedText: "Save changes"
    });

    expect(getMessageVariants(message)).toEqual(["Save changes"]);
    expect(messageVariantText(message)).toBe("Save changes");
  });

  it("honors local variant index override", () => {
    const message = assistantMessage({
      status: "complete",
      variants: ["first", "second"],
      variantIndex: 1
    });

    expect(messageVariantText(message, 0)).toBe("first");
  });
});
