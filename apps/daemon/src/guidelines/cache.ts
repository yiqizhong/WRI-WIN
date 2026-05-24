import type { GuidelineTreeResult } from "./discovery";

type CacheEntry = {
  result: GuidelineTreeResult;
  cachedAt: number;
};

let cache: CacheEntry | null = null;

export function getCachedTree(): GuidelineTreeResult | null {
  return cache?.result ?? null;
}

export function setCachedTree(result: GuidelineTreeResult): void {
  cache = { result, cachedAt: Date.now() };
}

export function invalidateCache(): void {
  cache = null;
}
