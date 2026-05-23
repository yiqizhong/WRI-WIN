import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

import {
  attachPasteTextFileInputSchema,
  createPasteTextConversationInputSchema,
  sendPasteTextMessageInputSchema,
  type PasteTextAttachment,
  type PasteTextConversation,
  type PasteTextMessage,
  type PasteTextMessageResult,
  type SpreadsheetParseResult
} from "@writer/contracts";
import { buildCopywriterPrompt, extractSuggestedTextFromAgentEvents } from "@writer/review-core";
import { parseSpreadsheetFile } from "@writer/spreadsheet";

import { startAgentRun } from "./agents";
import type { DaemonState } from "./state";
import { createSession } from "./state";

function nowIso(): string {
  return new Date().toISOString();
}

function historyFromMessages(messages: PasteTextMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    text: message.role === "assistant" ? message.suggestedText ?? message.text : message.text
  }));
}

function getProjectBrandVoice(state: DaemonState, projectId: string): string | undefined {
  const project = state.store.listProjects().projects.find((item) => item.id === projectId);
  return project?.brandVoice;
}

function buildRowContext(parseResult: SpreadsheetParseResult, rowIndex: number): string {
  const row = parseResult.rows.find((item) => item.index === rowIndex) ?? parseResult.rows[rowIndex];

  if (!row) {
    throw new Error(`Row ${rowIndex} not found in attachment`);
  }

  const lines = parseResult.columns.map((column) => {
    const value = row.cells[String(column.index)] ?? "";
    return `${column.header}: ${value}`;
  });

  return [`Row ${row.index}`, ...lines].join("\n");
}

function detectAttachmentKind(filePath: string): "spreadsheet" | "plain_text" {
  const extension = extname(filePath).toLowerCase();

  if (extension === ".csv" || extension === ".xlsx" || extension === ".xls") {
    return "spreadsheet";
  }

  if (extension === ".txt" || extension === ".md") {
    return "plain_text";
  }

  throw new Error("Unsupported attachment type. Use CSV, XLSX, TXT, or MD.");
}

async function ensureLinkedSession(
  state: DaemonState,
  conversation: PasteTextConversation,
  userText: string
): Promise<PasteTextConversation> {
  if (conversation.sessionId) {
    return conversation;
  }

  const session = await createSession(state, {
    projectId: conversation.projectId,
    sourceType: "pasted_text",
    scope: {
      text: userText,
      conversationId: conversation.id,
      itemCount: userText.split(/\n+/).filter(Boolean).length
    }
  });

  return {
    ...conversation,
    sessionId: session.id
  };
}

export async function createPasteTextConversation(
  state: DaemonState,
  input: unknown
): Promise<PasteTextConversation> {
  const parsed = createPasteTextConversationInputSchema.parse(input);
  const timestamp = nowIso();

  const conversation: PasteTextConversation = {
    id: randomUUID(),
    projectId: parsed.projectId,
    backgroundContext: parsed.backgroundContext,
    inputMode: "plain_text",
    messages: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return state.store.upsertPasteTextConversation(conversation);
}

export async function attachPasteTextFile(
  state: DaemonState,
  input: unknown
): Promise<PasteTextConversation> {
  const parsed = attachPasteTextFileInputSchema.parse(input);
  const conversation = getPasteTextConversation(state, parsed.conversationId);
  const fileName = basename(parsed.filePath);
  const mimeKind = detectAttachmentKind(parsed.filePath);
  const timestamp = nowIso();

  let attachment: PasteTextAttachment;

  if (mimeKind === "spreadsheet") {
    const parseResult = await parseSpreadsheetFile(parsed.filePath);
    attachment = {
      id: randomUUID(),
      fileName,
      filePath: parsed.filePath,
      mimeKind,
      parseResult,
      createdAt: timestamp
    };
  } else {
    const textContent = await readFile(parsed.filePath, "utf8");
    attachment = {
      id: randomUUID(),
      fileName,
      filePath: parsed.filePath,
      mimeKind,
      textContent,
      createdAt: timestamp
    };
  }

  const updated: PasteTextConversation = {
    ...conversation,
    inputMode: mimeKind === "spreadsheet" ? "structured_file" : "plain_text",
    attachment,
    updatedAt: timestamp
  };

  const saved = state.store.upsertPasteTextConversation(updated);
  await state.store.save();
  return saved;
}

export function getPasteTextConversation(state: DaemonState, conversationId: string): PasteTextConversation {
  const conversation = state.store.getPasteTextConversation(conversationId);

  if (!conversation) {
    throw new Error("Paste text conversation not found");
  }

  return conversation;
}

export async function sendPasteTextMessage(
  state: DaemonState,
  conversationId: string,
  input: unknown
): Promise<PasteTextMessageResult> {
  const parsed = sendPasteTextMessageInputSchema.parse(input);
  let conversation = getPasteTextConversation(state, conversationId);
  conversation = await ensureLinkedSession(state, conversation, parsed.text);

  const userMessage: PasteTextMessage = {
    id: randomUUID(),
    role: "user",
    text: parsed.text,
    rowIndex: parsed.rowIndex,
    createdAt: nowIso()
  };

  const priorMessages = [...conversation.messages, userMessage];

  let rowContext: string | undefined;
  if (parsed.rowIndex !== undefined && conversation.attachment?.mimeKind === "spreadsheet") {
    const parseResult = conversation.attachment.parseResult as SpreadsheetParseResult | undefined;
    if (!parseResult?.rows?.length) {
      throw new Error("Spreadsheet attachment is missing parsed rows");
    }
    rowContext = buildRowContext(parseResult, parsed.rowIndex);
  } else if (conversation.attachment?.mimeKind === "plain_text" && conversation.attachment.textContent) {
    rowContext = conversation.attachment.textContent;
  }

  const prompt = buildCopywriterPrompt({
    backgroundContext: conversation.backgroundContext,
    brandVoice: getProjectBrandVoice(state, conversation.projectId),
    history: historyFromMessages(conversation.messages),
    userText: parsed.text,
    rowContext
  });

  const runResult = await startAgentRun(state, {
    sessionId: conversation.sessionId!,
    prompt: prompt.full,
    adapterId: parsed.adapterId
  });

  const suggestedText = extractSuggestedTextFromAgentEvents(runResult.events);

  if (!suggestedText.trim()) {
    throw new Error("Agent returned empty rewrite");
  }

  const assistantMessage: PasteTextMessage = {
    id: randomUUID(),
    role: "assistant",
    text: suggestedText,
    suggestedText,
    createdAt: nowIso()
  };

  const updated: PasteTextConversation = {
    ...conversation,
    messages: [...priorMessages, assistantMessage],
    updatedAt: nowIso()
  };

  const saved = state.store.upsertPasteTextConversation(updated);
  await state.store.save();

  return {
    conversation: saved,
    userMessage,
    assistantMessage
  };
}
