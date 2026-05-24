import type { GuidelineSnapshot } from "@writer/contracts";

import type { ResolvedGuideline } from "./inheritance";

export function buildSnapshot(guideline: ResolvedGuideline): GuidelineSnapshot {
  return {
    guidelineId: guideline.id,
    guideline,
    contentHashes: { [guideline._filePath]: guideline._contentHash },
    capturedAt: new Date().toISOString()
  };
}
