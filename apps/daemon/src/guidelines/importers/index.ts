import type { Guideline } from "@writer/contracts";

export type ParseError = {
  file: string;
  line?: number;
  message: string;
};

export type ParseResult = { ok: true; guideline: Guideline } | { ok: false; error: ParseError };

export interface Importer {
  canHandle(filePath: string): boolean;
  parse(filePath: string): Promise<ParseResult>;
}

const registry: Importer[] = [];

export function registerImporter(importer: Importer): void {
  registry.push(importer);
}

export function findImporter(filePath: string): Importer | undefined {
  return registry.find((imp) => imp.canHandle(filePath));
}
