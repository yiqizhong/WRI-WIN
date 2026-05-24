const MCP_CODEGEN_MARKERS = [
  "SUPER CRITICAL",
  "DO NOT install",
  "Node ids have been added",
  "technology stack",
  "Tailwind classes",
  "data-node-id=",
  "figma.com/api/mcp/asset",
  "getNodeByIdAsync",
  "className=",
  "import React",
  "export default"
] as const;

const MAX_UI_COPY_LENGTH = 500;

export function isMcpCodegenNoise(text: string): boolean {
  const trimmed = text.trim();

  if (!trimmed) {
    return true;
  }

  if (trimmed.length > MAX_UI_COPY_LENGTH) {
    return true;
  }

  return MCP_CODEGEN_MARKERS.some((marker) => trimmed.includes(marker));
}

function stripCodegenSyntaxTail(text: string): string {
  return text
    .replace(/\s*\)\s*;\s*\}\s*$/g, "")
    .replace(/\s*[\);}]+\s*$/g, "")
    .trim();
}

export function stripMcpCodegenBoilerplate(text: string): string {
  let result = text;

  for (const marker of MCP_CODEGEN_MARKERS) {
    const index = result.indexOf(marker);

    if (index === 0) {
      return "";
    }

    if (index > 0) {
      result = result.slice(0, index);
    }
  }

  return stripCodegenSyntaxTail(result.trim());
}

/** Visible UI copy only — what a user sees on screen, with no MCP or codegen payload. */
export function toSurfaceCopy(text: string): string {
  return sanitizeCharactersForFigmaWrite(text);
}

export function isUsableSurfaceCopy(text: string): boolean {
  const surface = toSurfaceCopy(text);
  return surface.length > 0 && !isMcpCodegenNoise(surface);
}

export function sanitizeCharactersForFigmaWrite(characters: string): string {
  let text = stripMcpCodegenBoilerplate(characters);

  const templateMatch = text.match(/\{\s*`([^`]+)`\s*\}/);

  if (templateMatch?.[1]) {
    text = templateMatch[1];
  }

  text = stripCodegenSyntaxTail(
    text
      .replace(/^[`{\s;]+|[`}\s;]+$/g, "")
      .replace(/\\n/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );

  if (text.length > MAX_UI_COPY_LENGTH) {
    text = text.slice(0, MAX_UI_COPY_LENGTH).trim();
  }

  return text;
}

function cleanTextCandidate(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractCharactersFromDesignContext(code: string, fallbackName: string): string {
  const candidates: string[] = [];

  for (const match of code.matchAll(/>([^<]{1,200})</g)) {
    candidates.push(cleanTextCandidate(match[1] ?? ""));
  }

  for (const match of code.matchAll(/children:\s*["']([^"']+)["']/g)) {
    candidates.push(cleanTextCandidate(match[1] ?? ""));
  }

  for (const match of code.matchAll(/\{\s*`([^`]{1,200})`\s*\}/g)) {
    candidates.push(cleanTextCandidate(match[1] ?? ""));
  }

  for (const match of code.matchAll(/(?:title|label|placeholder|alt)=["']([^"']+)["']/gi)) {
    candidates.push(cleanTextCandidate(match[1] ?? ""));
  }

  const usable = candidates.filter((candidate) => candidate.length > 0 && !isMcpCodegenNoise(candidate));

  if (usable.length > 0) {
    return usable.sort((left, right) => left.length - right.length)[0];
  }

  const stripped = stripMcpCodegenBoilerplate(code.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  const sanitized = sanitizeCharactersForFigmaWrite(stripped);

  if (sanitized && !isMcpCodegenNoise(sanitized)) {
    return sanitized;
  }

  return fallbackName;
}
