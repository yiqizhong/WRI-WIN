export type MastheadRouteConfig = {
  title?: string;
  backTo?: string;
};

const ROUTE_MASTHEAD: Array<{ match: (path: string) => boolean; config: MastheadRouteConfig }> = [
  { match: (path) => path === "/settings", config: { title: "Settings", backTo: "/" } },
  { match: (path) => path === "/figma-audit", config: { title: "Figma Audit", backTo: "/" } },
  { match: (path) => path === "/text-copy", config: { title: "Chat" } },
  { match: (path) => path === "/audits", config: { title: "Audits", backTo: "/figma-audit" } },
  {
    match: (path) => /^\/audits\/[^/]+$/.test(path),
    config: { title: "Audit", backTo: "/audits" }
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
