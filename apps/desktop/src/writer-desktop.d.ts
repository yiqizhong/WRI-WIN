export {};

declare global {
  interface Window {
    writerDesktop: {
      platform: string;
      pickProjectFolder: () => Promise<string | null>;
    };
  }
}
