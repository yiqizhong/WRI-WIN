import { describe, it, expect } from "vitest";
import { planResume, classifyResumeResponse } from "./download-resume";

describe("planResume", () => {
  it("derives the offset from the actual tmp size", () => {
    expect(planResume(0)).toEqual({ resumeFrom: 0, rangeHeader: null });
    expect(planResume(1234)).toEqual({ resumeFrom: 1234, rangeHeader: "bytes=1234-" });
  });
});
describe("classifyResumeResponse", () => {
  it("appends only on a 206 resume", () => { expect(classifyResumeResponse(206, 1000)).toBe("append"); });
  it("restarts when a resume got 200 (Range ignored)", () => { expect(classifyResumeResponse(200, 1000)).toBe("restart"); });
  it("writes fresh on a first-time 200", () => { expect(classifyResumeResponse(200, 0)).toBe("write"); });
  it("errors on any other status", () => {
    expect(classifyResumeResponse(403, 0)).toBe("error");
    expect(classifyResumeResponse(500, 1000)).toBe("error");
  });
});
