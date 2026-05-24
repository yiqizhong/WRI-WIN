import { createHash } from "node:crypto";

import type { Rule, Surface, Term } from "@writer/contracts";

import type { ResolvedGuideline } from "../inheritance";
import type { GuidelineIndex, ProseChunk } from "./types";

const CHUNK_TOKEN_TARGET = 500;
const APPROX_CHARS_PER_TOKEN = 4;
const CHUNK_SIZE_CHARS = CHUNK_TOKEN_TARGET * APPROX_CHARS_PER_TOKEN;

function chunkId(filePath: string, headingPath: string, offset: number, content: string): string {
  return createHash("sha256")
    .update(`${filePath}|${headingPath}|${offset}|${content}`)
    .digest("hex")
    .slice(0, 24);
}

function buildProseChunks(guideline: ResolvedGuideline): ProseChunk[] {
  const chunks: ProseChunk[] = [];
  const lines = (guideline as unknown as { _prose?: string })._prose?.split("\n") ?? [];
  if (!lines.length) return chunks;

  let currentHeading = "";
  let buffer = "";
  let bufferOffset = 0;
  let lineOffset = 0;

  const flush = () => {
    const trimmed = buffer.trim();
    if (!trimmed) return;
    chunks.push({
      id: chunkId(guideline._filePath, currentHeading, bufferOffset, trimmed),
      filePath: guideline._filePath,
      headingPath: currentHeading,
      offset: bufferOffset,
      content: trimmed
    });
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      flush();
      buffer = "";
      currentHeading = line.slice(3).trim();
      bufferOffset = lineOffset;
    } else {
      buffer += line + "\n";
      if (buffer.length >= CHUNK_SIZE_CHARS) {
        flush();
        bufferOffset = lineOffset;
        buffer = "";
      }
    }
    lineOffset++;
  }
  flush();
  return chunks;
}

function keywordScore(chunk: ProseChunk, queryTokens: string[]): number {
  const text = chunk.content.toLowerCase();
  return queryTokens.reduce((score, token) => score + (text.includes(token) ? 1 : 0), 0);
}

export class InMemoryFullScanIndex implements GuidelineIndex {
  private rules: Rule[];
  private glossary: Term[];
  private chunks: ProseChunk[];

  constructor(guidelines: ResolvedGuideline[]) {
    this.rules = guidelines.flatMap((g) => g.rules);
    this.glossary = guidelines.flatMap((g) => g.glossary);
    this.chunks = guidelines.flatMap(buildProseChunks);
  }

  rulesBySurface(surface: Surface): Rule[] {
    return this.rules.filter((r) => r.surfaces.includes(surface));
  }

  termsByLiteral(text: string): Term[] {
    return this.glossary.filter((term) => {
      const candidates = term.forbidden ?? [term.term];
      return candidates.some((candidate) => {
        if (term.caseSensitive) return text.includes(candidate);
        return text.toLowerCase().includes(candidate.toLowerCase());
      });
    });
  }

  searchProse(query: string, limit: number): ProseChunk[] {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return [...this.chunks]
      .map((chunk) => ({ chunk, score: keywordScore(chunk, tokens) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ chunk }) => chunk);
  }
}
