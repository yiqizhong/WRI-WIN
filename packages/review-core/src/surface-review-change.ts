import type { ReviewChange } from "@writer/contracts";

import { toSurfaceCopy } from "./figma-text-sanitize";

export function normalizeReviewChangeSurface(change: ReviewChange): ReviewChange {
  return {
    ...change,
    before: toSurfaceCopy(change.before),
    after: toSurfaceCopy(change.after)
  };
}

export function normalizeReviewChangesSurface(changes: ReviewChange[]): ReviewChange[] {
  return changes.map(normalizeReviewChangeSurface);
}
