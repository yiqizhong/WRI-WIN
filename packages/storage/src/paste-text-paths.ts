import { join } from "node:path";

export const PASTE_TEXT_PARSE_RESULT_FILE = "attachment-parse-result.json";

export function getPasteTextParseResultPath(dataDir: string, conversationId: string): string {
  return join(dataDir, "conversations", conversationId, PASTE_TEXT_PARSE_RESULT_FILE);
}
