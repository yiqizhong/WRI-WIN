export type NavItem = {
  label: string;
  path: string;
  title: string;
  description: string;
  matchPaths: string[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Review",
    path: "/",
    title: "Review",
    description: "Approve, edit, or reject proposed copy.",
    matchPaths: ["/"]
  },
  {
    label: "Sources",
    path: "/figma",
    title: "Sources",
    description: "Rewrite copy from Figma or pasted text.",
    matchPaths: ["/figma"]
  },
  {
    label: "Guidelines",
    path: "/guidelines",
    title: "Guidelines",
    description: "UX writing standards that ground every audit.",
    matchPaths: ["/guidelines"]
  },
  {
    label: "Agents",
    path: "/agents",
    title: "Agents",
    description: "Configure LLM providers and MCP servers.",
    matchPaths: ["/agents"]
  },
  {
    label: "Settings",
    path: "/settings",
    title: "Settings",
    description: "Brand voice applied to every audit.",
    matchPaths: ["/settings"]
  }
];

export const DEFAULT_ROUTE = "/";

export function navItemForPath(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.matchPaths.includes(pathname));
}

export function titleForPath(pathname: string): string {
  return navItemForPath(pathname)?.title ?? "Writer";
}

export function descriptionForPath(pathname: string): string {
  return navItemForPath(pathname)?.description ?? "";
}
