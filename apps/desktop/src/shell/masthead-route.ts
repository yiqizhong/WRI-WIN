export type MastheadRouteConfig = {
  backTo?: string;
};

const ROUTE_MASTHEAD: Array<{ match: (path: string) => boolean; config: MastheadRouteConfig }> = [
  { match: (path) => path === "/settings", config: {} },
  { match: (path) => path === "/figma-audit", config: {} },
  { match: (path) => path === "/guide", config: {} },
  { match: (path) => path === "/text-copy", config: {} },
  { match: (path) => path === "/audits", config: {} },
  {
    match: (path) => /^\/audits\/[^/]+$/.test(path),
    config: {}
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
