import { describe, expect, it } from "vitest";

import {
  createPasteTextConversationInputSchema,
  parsePasteTextConversation,
  pasteTextConversationSchema
} from "./paste-text";

describe("paste-text contracts", () => {
  const baseConversation = {
    id: "conv-1",
    projectId: "proj-1",
    productId: "checkout",
    inputMode: "plain_text" as const,
    messages: [],
    createdAt: "2026-05-25T12:00:00.000Z",
    updatedAt: "2026-05-25T12:00:00.000Z"
  };

  it("round-trips conversation with all three guideline layers", () => {
    const payload = {
      ...baseConversation,
      guidelineSnapshot: {
        companyBase: { id: "company-base", contentHash: "abc", content: "Brand voice" },
        softwareWriting: { id: "software-writing", contentHash: "def", content: "UX rules" },
        productGuideline: { id: "checkout", contentHash: "ghi", content: "Product rules" }
      }
    };

    const parsed = parsePasteTextConversation(payload);
    expect(parsed.productId).toBe("checkout");
    expect(parsed.guidelineSnapshot?.companyBase?.content).toBe("Brand voice");
    expect(parsed.guidelineSnapshot?.softwareWriting?.content).toBe("UX rules");
    expect(parsed.guidelineSnapshot?.productGuideline?.content).toBe("Product rules");
  });

  it("round-trips conversation with partial snapshot layers", () => {
    const payload = {
      ...baseConversation,
      guidelineSnapshot: {
        companyBase: { id: "company-base", contentHash: "abc", content: "Brand voice" },
        productGuideline: { id: "checkout", contentHash: "ghi", content: "Product rules" }
      }
    };

    const parsed = parsePasteTextConversation(payload);
    expect(parsed.guidelineSnapshot?.softwareWriting).toBeUndefined();
    expect(parsed.guidelineSnapshot?.productGuideline?.id).toBe("checkout");
  });

  it("accepts conversation without guideline snapshot", () => {
    const parsed = parsePasteTextConversation(baseConversation);
    expect(parsed.guidelineSnapshot).toBeUndefined();
  });

  it("accepts conversation without productId", () => {
    const { productId: _removed, ...withoutProduct } = baseConversation;
    const parsed = parsePasteTextConversation(withoutProduct);
    expect(parsed.productId).toBeUndefined();
  });

  it("accepts create input without productId", () => {
    const parsed = createPasteTextConversationInputSchema.parse({
      projectId: "proj-1"
    });
    expect(parsed.productId).toBeUndefined();
  });
});
