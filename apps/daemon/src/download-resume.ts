export function planResume(tmpSizeOnDisk: number): { resumeFrom: number; rangeHeader: string | null } {
  if (tmpSizeOnDisk > 0) return { resumeFrom: tmpSizeOnDisk, rangeHeader: `bytes=${tmpSizeOnDisk}-` };
  return { resumeFrom: 0, rangeHeader: null };
}
export type ResumeAction = "append" | "restart" | "write" | "error";
export function classifyResumeResponse(status: number, resumeFrom: number): ResumeAction {
  if (status !== 200 && status !== 206) return "error";
  if (resumeFrom > 0) return status === 206 ? "append" : "restart";
  return "write";
}
