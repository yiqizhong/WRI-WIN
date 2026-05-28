import { describe, expect, it } from "vitest";

import { parseFigmaAuditResults } from "./figma-audit-prompt";

describe("parseFigmaAuditResults", () => {
  it("parses a clean JSON object", () => {
    const raw = JSON.stringify({
      results: [{ id: "1:1", suggestion: "Sign in", changed: true, rationale: "Term rule" }]
    });
    const results = parseFigmaAuditResults(raw);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: "1:1",
      suggestion: "Sign in",
      changed: true,
      rationale: "Term rule"
    });
  });

  it("strips ```json code fences", () => {
    const raw = "```json\n{\"results\":[{\"id\":\"1:1\",\"suggestion\":\"Hi\",\"changed\":false}]}\n```";
    const results = parseFigmaAuditResults(raw);
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("1:1");
    expect(results[0]!.changed).toBe(false);
  });

  it("extracts a JSON object wrapped in prose", () => {
    const raw = 'Here are the results:\n{"results":[{"id":"a","suggestion":"x","changed":true}]}\nLet me know!';
    const results = parseFigmaAuditResults(raw);
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("a");
  });

  it("coerces missing rationale to an empty string and missing changed to false", () => {
    const raw = '{"results":[{"id":"a","suggestion":"x"}]}';
    const results = parseFigmaAuditResults(raw);
    expect(results[0]!.rationale).toBe("");
    expect(results[0]!.changed).toBe(false);
  });

  it("drops entries missing id or suggestion", () => {
    const raw =
      '{"results":[{"id":"a","suggestion":"x","changed":true},{"suggestion":"y"},{"id":"b"}]}';
    const results = parseFigmaAuditResults(raw);
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("a");
  });

  it("returns [] for malformed JSON", () => {
    expect(parseFigmaAuditResults("not json at all")).toEqual([]);
    expect(parseFigmaAuditResults('{"results": [oops}')).toEqual([]);
  });

  it("returns [] when results is not an array", () => {
    expect(parseFigmaAuditResults('{"results": "nope"}')).toEqual([]);
    expect(parseFigmaAuditResults("{}")).toEqual([]);
  });
});
