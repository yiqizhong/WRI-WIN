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

import { launchAgentRun, type AgentRunResult } from "./agents";
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

type RewriteJob = {
  conversationId: string;
  assistantMessageId: string;
  sessionId: string;
  prompt: string;
  adapterId?: string;
};

async function updateAssistantMessage(
  state: DaemonState,
  job: RewriteJob,
  patch: Pick<PasteTextMessage, "status" | "text" | "suggestedText" | "errorMessage" | "agentRunId">
): Promise<void> {
  const conversation = getPasteTextConversation(state, job.conversationId);
  const messages = conversation.messages.map((message) =>
    message.id === job.assistantMessageId ? { ...message, ...patch } : message
  );

  state.store.upsertPasteTextConversation({
    ...conversation,
    messages,
    updatedAt: nowIso()
  });
  await state.store.save();
}

async function startPasteTextRewrite(
  state: DaemonState,
  job: RewriteJob
): Promise<{ completion: Promise<AgentRunResult> }> {
  const { run, completion } = await launchAgentRun(state, {
    sessionId: job.sessionId,
    prompt: job.prompt,
    adapterId: job.adapterId
  });

  await updateAssistantMessage(state, job, {
    status: "pending",
    text: "Rewriting…",
    agentRunId: run.id
  });

  return { completion };
}

async function finishPasteTextRewrite(
  state: DaemonState,
  job: RewriteJob,
  completion: Promise<AgentRunResult>
): Promise<void> {
  try {
    const runResult = await completion;
    const suggestedText = extractSuggestedTextFromAgentEvents(runResult.events);

    if (!suggestedText.trim()) {
      throw new Error("Agent returned empty rewrite");
    }

    await updateAssistantMessage(state, job, {
      status: "complete",
      text: suggestedText,
      suggestedText
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rewrite failed";
    await updateAssistantMessage(state, job, {
      status: "failed",
      text: message,
      errorMessage: message
    });
  }
}

async function runPasteTextRewrite(state: DaemonState, job: RewriteJob): Promise<void> {
  const { completion } = await startPasteTextRewrite(state, job);
  await finishPasteTextRewrite(state, job, completion);
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

  const assistantMessage: PasteTextMessage = {
    id: randomUUID(),
    role: "assistant",
    text: "Rewriting…",
    status: "pending",
    createdAt: nowIso()
  };

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

  const updated: PasteTextConversation = {
    ...conversation,
    messages: [...conversation.messages, userMessage, assistantMessage],
    updatedAt: nowIso()
  };

  const saved = state.store.upsertPasteTextConversation(updated);
  await state.store.save();

  const job: RewriteJob = {
    conversationId: saved.id,
    assistantMessageId: assistantMessage.id,
    sessionId: saved.sessionId!,
    prompt: prompt.full,
    adapterId: parsed.adapterId
  };

  if (parsed.sync) {
    await runPasteTextRewrite(state, job);
    const reloaded = getPasteTextConversation(state, conversationId);
    const reloadedAssistant = reloaded.messages.find((message) => message.id === assistantMessage.id)!;
    return {
      conversation: reloaded,
      userMessage,
      assistantMessage: reloadedAssistant
    };
  }

  const { completion } = await startPasteTextRewrite(state, job);
  void finishPasteTextRewrite(state, job, completion);

  const reloaded = getPasteTextConversation(state, conversationId);
  const reloadedAssistant = reloaded.messages.find((message) => message.id === assistantMessage.id)!;

  return {
    conversation: reloaded,
    userMessage,
    assistantMessage: reloadedAssistant
  };
}
