import { describe, expect, it } from "vitest";

import {
  buildCopywriterPrompt,
  estimateTokens,
  filterCopywriterHistory,
  isCopywriterBareGreeting,
  isCopywriterMetaOutput,
  isCopywriterOffTopicRefusal,
  isUnexpectedCopywriterRefusal,
  normalizeCopyToRewrite,
  parseCopywriterResponse,
  shouldRefuseCopywriterInput,
  shouldShortCircuitCopywriterInput,
  trimHistoryToBudget
} from "./copywriter-skill";

describe("copywriter-skill", () => {
  it("injects background and brand voice into prompt", () => {
    const prompt = buildCopywriterPrompt({
      backgroundContext: "Settings page, formal tone",
      brandVoice: "Clear and direct",
      userText: "Click here to save"
    });

    expect(prompt.full).toContain("Senior Software Copywriter");
    expect(prompt.full).toContain("Settings page, formal tone");
    expect(prompt.full).toContain("Clear and direct");
    expect(prompt.full).toContain("Click here to save");
    expect(prompt.full).toContain("Respond with only the rewritten text");
  });

  it("parses plain rewrite output", () => {
    const result = parseCopywriterResponse("Save changes");
    expect(result.suggestedText).toBe("Save changes");
  });

  it("parses labeled rewrite output", () => {
    const result = parseCopywriterResponse("Suggested rewrite: Save your changes");
    expect(result.suggestedText).toBe("Save your changes");
  });

  it("preserves off-topic refusal", () => {
    const result = parseCopywriterResponse("I can only rewrite UX copy. Paste the text you want improved.");
    expect(result.suggestedText).toContain("I can only rewrite UX copy");
  });

  it("detects duplicated off-topic refusal", () => {
    expect(
      isCopywriterOffTopicRefusal(
        "I can only rewrite UX copy. Paste the text you want improved.I can only rewrite UX copy. Paste the text you want improved."
      )
    ).toBe(true);
  });

  it("drops refusal-only history from the prompt", () => {
    const history = [
      { role: "user" as const, text: "I can only rewrite UX copy. Paste the text you want improved." },
      { role: "assistant" as const, text: "I can only rewrite UX copy. Paste the text you want improved." }
    ];
    const prompt = buildCopywriterPrompt({
      history,
      userText: "新的 copywriter 提示会随这次 daemon 启动生效。"
    });

    expect(filterCopywriterHistory(history)).toEqual([]);
    expect(prompt.full).not.toContain("Conversation history:");
  });

  it("strips refusal prefix when rewrite text follows", () => {
    const result = parseCopywriterResponse(
      "I can only rewrite UX copy. Paste the text you want improved.\nNew copywriter prompts are active after restart."
    );
    expect(result.suggestedText).toBe("New copywriter prompts are active after restart.");
  });

  it("strips design-note and codebase meta from model output", () => {
    const result = parseCopywriterResponse(
      'You can drop this directly into your codebase for your "Writer" tool or 3D project:\n\nAdd this to your Writer tool or 3D project codebase.\n\nDesign Note: English is better.'
    );
    expect(result.suggestedText).toBe("Add this to your Writer tool or 3D project codebase.");
    expect(isCopywriterMetaOutput("Design Note: English is better.")).toBe(true);
  });

  it("strips Design Note prefix before rewrite", () => {
    expect(
      normalizeCopyToRewrite(
        "Design Note: Since you are building this for your internal/open-source tools, using English will feel natural."
      )
    ).toBe("Since you are building this for your internal/open-source tools, using English will feel natural.");

    const prompt = buildCopywriterPrompt({
      userText:
        "Design Note: Since you are building this for your internal/open-source tools, using English will feel natural."
    });
    expect(prompt.full).toContain("Copy to rewrite:\nSince you are building this for your internal");
  });

  it("short-circuits bare greetings and guard echo only", () => {
    expect(shouldShortCircuitCopywriterInput("hi")).toContain("I can only rewrite UX copy");
    expect(shouldShortCircuitCopywriterInput("thanks!")).toContain("I can only rewrite UX copy");
    expect(
      shouldShortCircuitCopywriterInput("I can only rewrite UX copy. Paste the text you want improved.")
    ).toContain("refusal message");
    expect(shouldShortCircuitCopywriterInput("Confirm your email")).toBeNull();
    expect(shouldShortCircuitCopywriterInput("what does this feature do?")).toBeNull();
    expect(isCopywriterBareGreeting("Hello")).toBe(true);
    expect(shouldRefuseCopywriterInput("Design Note: Use English for labels.")).toBe(false);
  });

  it("treats model refusal as unexpected unless input is a bare greeting", () => {
    expect(
      isUnexpectedCopywriterRefusal(
        "Confirm your email",
        "I can only rewrite UX copy. Paste the text you want improved."
      )
    ).toBe(true);
    expect(
      isUnexpectedCopywriterRefusal("hi", "I can only rewrite UX copy. Paste the text you want improved.")
    ).toBe(false);
  });

  it("prompts for status-string lists without developer commentary", () => {
    const prompt = buildCopywriterPrompt({
      userText: '"Waking up neural pathways...",\n  "Thinking about tacos..."'
    });

    expect(prompt.full).toContain("JSON array of short status strings");
    expect(prompt.full).toContain('Never add new "Design Note" sections');
  });

  it("defaults to rewriting text under Copy to rewrite", () => {
    const prompt = buildCopywriterPrompt({
      userText: "Both travel clockwise together as a pair, both fade out via the shared"
    });

    expect(prompt.full).toContain('Always rewrite everything under "Copy to rewrite"');
    expect(prompt.full).not.toContain("If the request is off-topic");
  });

  it("defaults to rewriting in the system prompt", () => {
    const prompt = buildCopywriterPrompt({
      userText: "what does this feature do?",
      history: [{ role: "assistant", text: "I can only rewrite UX copy. Paste the text you want improved." }]
    });

    expect(prompt.full).toContain("Always rewrite everything under");
    expect(prompt.full).toContain('bare greeting with nothing to rewrite');
    expect(prompt.full).not.toContain("direct question such as");
  });

  it("emits three guideline layers in priority order with conflict resolution", () => {
    const prompt = buildCopywriterPrompt({
      companyBase: "Company rules",
      softwareWriting: "Software rules",
      productGuideline: "Product rules",
      userText: "Click here"
    });

    const companyIndex = prompt.full.indexOf("Writing rules (Company Base):");
    const softwareIndex = prompt.full.indexOf("Writing rules (Software Writing):");
    const productIndex = prompt.full.indexOf("Writing rules (Product):");
    expect(companyIndex).toBeGreaterThan(-1);
    expect(softwareIndex).toBeGreaterThan(companyIndex);
    expect(productIndex).toBeGreaterThan(softwareIndex);
    expect(prompt.full).toContain("prefer Product over Software Writing over Company Base");
  });

  it("omits missing software writing layer without placeholders", () => {
    const prompt = buildCopywriterPrompt({
      companyBase: "Company rules",
      productGuideline: "Product rules",
      userText: "Click here"
    });

    expect(prompt.full).toContain("Writing rules (Company Base):");
    expect(prompt.full).toContain("Writing rules (Product):");
    expect(prompt.full).not.toContain("Writing rules (Software Writing):");
    expect(prompt.full).toContain("prefer Product over Software Writing over Company Base");
  });

  it("keeps history and user text after guideline sections", () => {
    const prompt = buildCopywriterPrompt({
      companyBase: "Company rules",
      history: [{ role: "user", text: "Old copy" }],
      userText: "New copy"
    });

    const rulesIndex = prompt.full.indexOf("Writing rules (Company Base):");
    const historyIndex = prompt.full.indexOf("Conversation history:");
    const copyIndex = prompt.full.indexOf("Copy to rewrite:");
    expect(rulesIndex).toBeLessThan(historyIndex);
    expect(historyIndex).toBeLessThan(copyIndex);
  });

  it("emits feature context after writing rules and before history", () => {
    const prompt = buildCopywriterPrompt({
      companyBase: "Company rules",
      featureName: "Checkout",
      description: "Payment confirmation flow",
      history: [{ role: "user", text: "Old copy" }],
      userText: "New copy"
    });

    expect(prompt.full).toContain("Feature context:");
    expect(prompt.full).toContain("Feature: Checkout");
    expect(prompt.full).toContain("Description: Payment confirmation flow");

    const rulesIndex = prompt.full.indexOf("Writing rules (Company Base):");
    const featureIndex = prompt.full.indexOf("Feature context:");
    const historyIndex = prompt.full.indexOf("Conversation history:");
    expect(rulesIndex).toBeLessThan(featureIndex);
    expect(featureIndex).toBeLessThan(historyIndex);
  });

  it("omits feature context when both fields are absent", () => {
    const prompt = buildCopywriterPrompt({
      companyBase: "Company rules",
      userText: "New copy"
    });

    expect(prompt.full).not.toContain("Feature context:");
  });
});

describe("buildCopywriterPrompt token budget", () => {
  it("drops oldest history when a small context window cannot fit it", () => {
    const longTurn = (label: string) => ({ role: "user" as const, text: `${label} ${"word ".repeat(200)}` });
    const prompt = buildCopywriterPrompt({
      userText: "Rewrite: Save changes",
      history: [longTurn("OLDEST"), longTurn("MIDDLE"), longTurn("NEWEST")],
      contextWindow: 1500
    });
    // The newest long turn survives; the oldest is squeezed out by the budget.
    expect(prompt.user).toContain("NEWEST");
    expect(prompt.user).not.toContain("OLDEST");
  });

  it("keeps all history when the window is large", () => {
    const prompt = buildCopywriterPrompt({
      userText: "Rewrite: Save changes",
      history: [
        { role: "user", text: "first question" },
        { role: "assistant", text: "first answer" }
      ],
      contextWindow: 16384
    });
    expect(prompt.user).toContain("first question");
    expect(prompt.user).toContain("first answer");
  });
});

describe("estimateTokens", () => {
  it("estimates ~1 token per 4 characters, rounding up", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});

describe("trimHistoryToBudget", () => {
  const msg = (role: "user" | "assistant", text: string) => ({ role, text });

  it("keeps the newest turns and drops the oldest when over budget", () => {
    const history = [
      msg("user", "AAAAAAAA"),      // 8 chars -> 2 tokens
      msg("assistant", "BBBBBBBB"), // 2 tokens
      msg("user", "CCCCCCCC")       // 2 tokens
    ];
    // Budget for 4 tokens keeps only the last two messages (2 + 2).
    const kept = trimHistoryToBudget(history, 4);
    expect(kept).toEqual([msg("assistant", "BBBBBBBB"), msg("user", "CCCCCCCC")]);
  });

  it("returns chronological order", () => {
    const history = [msg("user", "one"), msg("assistant", "two"), msg("user", "three")];
    const kept = trimHistoryToBudget(history, 1000);
    expect(kept).toEqual(history);
  });

  it("never exceeds the token budget", () => {
    const history = Array.from({ length: 20 }, (_, i) => msg("user", "x".repeat(40)));
    const kept = trimHistoryToBudget(history, 30); // each msg ~10 tokens
    const total = kept.reduce((sum, m) => sum + estimateTokens(m.text), 0);
    expect(total).toBeLessThanOrEqual(30);
  });

  it("drops everything when budget is zero or negative", () => {
    expect(trimHistoryToBudget([msg("user", "hi")], 0)).toEqual([]);
    expect(trimHistoryToBudget([msg("user", "hi")], -5)).toEqual([]);
  });
});
