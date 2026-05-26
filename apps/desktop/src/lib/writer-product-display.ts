/** User-facing product label — uppercase; underlying id/name on disk unchanged. */
export function formatProductDisplayName(name: string): string {
  return name.toLocaleUpperCase("en-US");
}
