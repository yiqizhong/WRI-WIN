import type { FigmaExtractionSuccess } from "@writer/review-core";

const CACHE_TTL_MS = 60_000;

type CacheEntry = {
  expiresAt: number;
  result: FigmaExtractionSuccess;
};

const extractionCache = new Map<string, CacheEntry>();

export function getCachedFigmaExtraction(key: string): FigmaExtractionSuccess | null {
  const entry = extractionCache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    extractionCache.delete(key);
    return null;
  }

  return entry.result;
}

export function setCachedFigmaExtraction(key: string, result: FigmaExtractionSuccess): void {
  extractionCache.set(key, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

export function figmaExtractionCacheKey(fileKey: string, nodeId: string | undefined): string {
  return `${fileKey}:${nodeId ?? "root"}`;
}

export function clearFigmaExtractionCache(): void {
  extractionCache.clear();
}
