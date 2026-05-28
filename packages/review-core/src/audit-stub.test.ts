import { describe, expect, it } from "vitest";

import type { ThreeLayerGuidelineSnapshot } from "@writer/contracts";

import { runStubAudit } from "./audit-stub";

const SESSION_ID = "sess-test";
const SOURCE_TYPE = "figma" as const;

const snapshotWithGlossary: ThreeLayerGuidelineSnapshot = {
  companyBase: {
    id: "company-base",
    name: "Company Base",
    layer: "company-base",
    body: "Write clearly and concisely.",
    rules: [],
    glossary: []
  },
  softwareWriting: {
    id: "software-writing",
    name: "Software Writing",
    layer: "software-writing",
    rules: [],
    glossary: []
  },
  productPackage: {
    id: "checkout",
    name: "Checkout",
    glossary: [
      {
        id: "term-signin",
        term: "Sign in",
        status: "active",
        forbidden: ["Login", "log in"],
        caseSensitive: false,
        reason: "Product consistency"
      }
    ],
    extraFiles: []
  },
  contentHashes: {},
  capturedAt: "2024-01-01T00:00:00Z"
};

describe("runStubAudit — without guidelines", () => {
  it("returns no findings when no guideline snapshot is provided", () => {
    const result = runStubAudit({
      sessionId: SESSION_ID,
      sourceType: SOURCE_TYPE,
      items: [{ sourceId: "n1", text: "Click here" }]
    });

    expect(result.findings).toHaveLength(0);
    expect(result.rewrites).toHaveLength(0);
  });

  it("skips items with no usable copy", () => {
    const result = runStubAudit({
      sessionId: SESSION_ID,
      sourceType: SOURCE_TYPE,
      items: [{ sourceId: "n1", text: "" }]
    });

    expect(result.findings).toHaveLength(0);
    expect(result.rewrites).toHaveLength(0);
  });
});

describe("runStubAudit — with guideline snapshot", () => {
  it("generates a terminology finding when a forbidden term is present", () => {
    const result = runStubAudit({
      sessionId: SESSION_ID,
      sourceType: SOURCE_TYPE,
      items: [{ sourceId: "n1", text: "Login to continue" }],
      guidelineSnapshot: snapshotWithGlossary
    });

    const termFindings = result.findings.filter((f) => f.issueType === "terminology");
    expect(termFindings).toHaveLength(1);
    expect(termFindings[0]!.termId).toBe("term-signin");
    expect(termFindings[0]!.source).toBe("glossary");
    expect(termFindings[0]!.rationale).toContain("Sign in");
    expect(termFindings[0]!.rationale).toContain("Login");
  });

  it("populates guidelineSource on the rewrite for a glossary violation", () => {
    const result = runStubAudit({
      sessionId: SESSION_ID,
      sourceType: SOURCE_TYPE,
      items: [{ sourceId: "n1", text: "Login to continue" }],
      guidelineSnapshot: snapshotWithGlossary
    });

    const termRewrites = result.rewrites.filter((r) => r.guidelineSource?.layer === "product");
    expect(termRewrites).toHaveLength(1);
    expect(termRewrites[0]!.guidelineSource?.termId).toBe("term-signin");
    expect(termRewrites[0]!.guidelineSource?.excerpt).toContain("Sign in");
    expect(termRewrites[0]!.before).toBe("Login to continue");
    expect(termRewrites[0]!.after).toBe("Sign in to continue");
  });

  it("links rewrite findingId to the terminology finding", () => {
    const result = runStubAudit({
      sessionId: SESSION_ID,
      sourceType: SOURCE_TYPE,
      items: [{ sourceId: "n1", text: "Login to continue" }],
      guidelineSnapshot: snapshotWithGlossary
    });

    const finding = result.findings.find((f) => f.issueType === "terminology")!;
    const rewrite = result.rewrites.find((r) => r.guidelineSource?.termId === "term-signin")!;
    expect(rewrite.findingId).toBe(finding.id);
  });

  it("does not generate a terminology finding when no forbidden term is present", () => {
    const result = runStubAudit({
      sessionId: SESSION_ID,
      sourceType: SOURCE_TYPE,
      items: [{ sourceId: "n1", text: "Sign in to continue" }],
      guidelineSnapshot: snapshotWithGlossary
    });

    expect(result.findings.filter((f) => f.issueType === "terminology")).toHaveLength(0);
  });

  it("handles forbidden terms containing regex metacharacters without throwing", () => {
    const snapshot: ThreeLayerGuidelineSnapshot = {
      ...snapshotWithGlossary,
      productPackage: {
        id: "checkout",
        name: "Checkout",
        glossary: [
          {
            id: "term-cpp",
            term: "C#",
            status: "active",
            forbidden: ["C++"],
            caseSensitive: false,
            reason: "Standardize language name"
          }
        ],
        extraFiles: []
      }
    };

    const run = () =>
      runStubAudit({
        sessionId: SESSION_ID,
        sourceType: SOURCE_TYPE,
        items: [{ sourceId: "n1", text: "Built with C++ today" }],
        guidelineSnapshot: snapshot
      });

    expect(run).not.toThrow();
    const result = run();
    const rewrite = result.rewrites.find((r) => r.guidelineSource?.termId === "term-cpp");
    expect(rewrite?.before).toBe("Built with C++ today");
    expect(rewrite?.after).toBe("Built with C# today");
  });

  it("honors caseSensitive on replacement", () => {
    const snapshot: ThreeLayerGuidelineSnapshot = {
      ...snapshotWithGlossary,
      productPackage: {
        id: "checkout",
        name: "Checkout",
        glossary: [
          {
            id: "term-api",
            term: "API key",
            status: "active",
            forbidden: ["APIKEY"],
            caseSensitive: true,
            reason: "Spacing convention"
          }
        ],
        extraFiles: []
      }
    };

    // Different case ("apikey") must NOT match a case-sensitive forbidden term.
    const noMatch = runStubAudit({
      sessionId: SESSION_ID,
      sourceType: SOURCE_TYPE,
      items: [{ sourceId: "n1", text: "Your apikey is ready" }],
      guidelineSnapshot: snapshot
    });
    expect(noMatch.findings.filter((f) => f.issueType === "terminology")).toHaveLength(0);

    // Exact case matches and only that exact occurrence is replaced.
    const match = runStubAudit({
      sessionId: SESSION_ID,
      sourceType: SOURCE_TYPE,
      items: [{ sourceId: "n2", text: "Your APIKEY is ready" }],
      guidelineSnapshot: snapshot
    });
    const rewrite = match.rewrites.find((r) => r.guidelineSource?.termId === "term-api");
    expect(rewrite?.after).toBe("Your API key is ready");
  });
});
