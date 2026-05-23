export {};

declare global {
  interface Window {
    writerDesktop: {
      platform: string;
      pickProjectFolder: () => Promise<string | null>;
      pickSpreadsheetFile: () => Promise<string | null>;
      pickSaveFile: (options: {
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
      }) => Promise<string | null>;
      saveTextFile: (filePath: string, content: string) => Promise<string>;
      exportPdfFromHtml: (filePath: string, html: string) => Promise<string>;
    };
  }
}
