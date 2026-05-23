export type NavItem = {
  label: string;
  path: string;
  title: string;
  matchPaths: string[];
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Review", path: "/", title: "Review", matchPaths: ["/"] },
  { label: "Sources", path: "/figma", title: "Sources", matchPaths: ["/figma"] },
  { label: "Agents", path: "/agents", title: "Agents", matchPaths: ["/agents"] },
  { label: "Settings", path: "/settings", title: "Settings", matchPaths: ["/settings"] }
];

export const DEFAULT_ROUTE = "/";

export function titleForPath(pathname: string): string {
  return NAV_ITEMS.find((item) => item.matchPaths.includes(pathname))?.title ?? "Writer";
}
