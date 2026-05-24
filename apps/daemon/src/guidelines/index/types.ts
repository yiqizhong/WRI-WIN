import type { Rule, Surface, Term } from "@writer/contracts";

export type ProseChunk = {
  id: string;
  filePath: string;
  headingPath: string;
  offset: number;
  content: string;
};

export interface GuidelineIndex {
  rulesBySurface(surface: Surface): Rule[];
  termsByLiteral(text: string): Term[];
  searchProse(query: string, limit: number): ProseChunk[];
}
