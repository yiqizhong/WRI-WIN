import type { AppUpdateState } from "@writer/contracts";

export {};

declare global {
  interface Window {
    writerDesktop: {
      appVersion: string;
      platform: string;
      windowChrome: "transparent" | "opaque";
      windowMinimize: () => void;
      windowMaximize: () => void;
      windowClose: () => void;
      windowIsMaximized: () => Promise<boolean>;
      openExternal: (url: string) => Promise<boolean>;
      pickProjectFolder: () => Promise<string | null>;
      pickSpreadsheetFile: () => Promise<string | null>;
      pickPasteTextAttachment: (kind?: "spreadsheet" | "plain_text") => Promise<string | null>;
      pickSaveFile: (options: {
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
      }) => Promise<string | null>;
      saveTextFile: (filePath: string, content: string) => Promise<string>;
      exportPdfFromHtml: (filePath: string, html: string) => Promise<string>;
      pickGuidelineFile: () => Promise<{ filename: string; content: string } | null>;
      pickGlossaryFile: () => Promise<{ filename: string; content: string; format: "csv" | "md" } | null>;
      setBackgroundMaterial?: (
        material: "none" | "mica" | "acrylic" | "tabbed"
      ) => Promise<boolean>;
    };
    writerUpdate?: {
      check: () => Promise<unknown>;
      download: () => Promise<unknown>;
      restartToInstall: () => Promise<unknown>;
      getState: () => Promise<unknown>;
      onState: (callback: (state: AppUpdateState) => void) => () => void;
    };
  }
}
