export {};

declare global {
  interface Window {
    writerDesktop: {
      platform: string;
      openExternal: (url: string) => Promise<boolean>;
      pickProjectFolder: () => Promise<string | null>;
      pickSpreadsheetFile: () => Promise<string | null>;
      pickPasteTextAttachment: () => Promise<string | null>;
      pickSaveFile: (options: {
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
      }) => Promise<string | null>;
      saveTextFile: (filePath: string, content: string) => Promise<string>;
      exportPdfFromHtml: (filePath: string, html: string) => Promise<string>;
      pickGuidelineFile: () => Promise<{ filename: string; content: string } | null>;
      pickGlossaryFile: () => Promise<{ filename: string; content: string; format: "csv" | "md" } | null>;
    };
  }
}
