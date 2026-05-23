import { z } from "zod";

export const pasteTextInputModeSchema = z.enum(["plain_text", "structured_file"]);

export const pasteTextMessageRoleSchema = z.enum(["user", "assistant"]);

export const pasteTextMessageSchema = z.object({
  id: z.string().min(1),
  role: pasteTextMessageRoleSchema,
  text: z.string(),
  suggestedText: z.string().optional(),
  rowIndex: z.number().int().nonnegative().optional(),
  createdAt: z.iso.datetime()
});

export const pasteTextAttachmentSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1),
  filePath: z.string().min(1),
  mimeKind: z.enum(["spreadsheet", "plain_text"]),
  parseResult: z.record(z.string(), z.unknown()).optional(),
  textContent: z.string().optional(),
  createdAt: z.iso.datetime()
});

export const pasteTextConversationSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  backgroundContext: z.string().optional(),
  inputMode: pasteTextInputModeSchema,
  sessionId: z.string().min(1).optional(),
  attachment: pasteTextAttachmentSchema.optional(),
  messages: z.array(pasteTextMessageSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
});

export const createPasteTextConversationInputSchema = z.object({
  projectId: z.string().min(1),
  backgroundContext: z.string().optional()
});

export const sendPasteTextMessageInputSchema = z.object({
  text: z.string().min(1),
  rowIndex: z.number().int().nonnegative().optional(),
  adapterId: z.string().min(1).optional()
});

export const attachPasteTextFileInputSchema = z.object({
  conversationId: z.string().min(1),
  filePath: z.string().min(1)
});

export const pasteTextMessageResultSchema = z.object({
  conversation: pasteTextConversationSchema,
  userMessage: pasteTextMessageSchema,
  assistantMessage: pasteTextMessageSchema
});

export const pasteTextConversationListSchema = z.object({
  conversations: z.array(pasteTextConversationSchema)
});

export type PasteTextInputMode = z.infer<typeof pasteTextInputModeSchema>;
export type PasteTextMessageRole = z.infer<typeof pasteTextMessageRoleSchema>;
export type PasteTextMessage = z.infer<typeof pasteTextMessageSchema>;
export type PasteTextAttachment = z.infer<typeof pasteTextAttachmentSchema>;
export type PasteTextConversation = z.infer<typeof pasteTextConversationSchema>;
export type CreatePasteTextConversationInput = z.infer<typeof createPasteTextConversationInputSchema>;
export type SendPasteTextMessageInput = z.infer<typeof sendPasteTextMessageInputSchema>;
export type AttachPasteTextFileInput = z.infer<typeof attachPasteTextFileInputSchema>;
export type PasteTextMessageResult = z.infer<typeof pasteTextMessageResultSchema>;
export type PasteTextConversationList = z.infer<typeof pasteTextConversationListSchema>;

export function parsePasteTextConversation(payload: unknown): PasteTextConversation {
  return pasteTextConversationSchema.parse(payload);
}

export function parsePasteTextMessageResult(payload: unknown): PasteTextMessageResult {
  return pasteTextMessageResultSchema.parse(payload);
}
