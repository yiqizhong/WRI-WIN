export type MastheadRouteConfig = {
  title?: string;
  backTo?: string;
};

const ROUTE_MASTHEAD: Array<{ match: (path: string) => boolean; config: MastheadRouteConfig }> = [
  { match: (path) => path === "/settings", config: {} },
  { match: (path) => path === "/figma-audit", config: { title: "Figma Audit" } },
  { match: (path) => path === "/text-copy", config: { title: "Chat" } },
  { match: (path) => path === "/audits", config: { title: "Audits" } },
  {
    match: (path) => /^\/audits\/[^/]+$/.test(path),
    config: { title: "Audit" }
  }
];

export function mastheadConfigForPath(pathname: string): MastheadRouteConfig {
  for (const { match, config } of ROUTE_MASTHEAD) {
    if (match(pathname)) {
      return config;
    }
  }
  return {};
}
