export interface NavItem {
  label: string;
  path: string;
  iconName: "review" | "sources" | "agents" | "settings";
  matchPaths: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Review", path: "/", iconName: "review", matchPaths: ["/"] },
  { label: "Sources", path: "/figma", iconName: "sources", matchPaths: ["/figma"] },
  { label: "Agents", path: "/agents", iconName: "agents", matchPaths: ["/agents"] },
  { label: "Settings", path: "/settings", iconName: "settings", matchPaths: ["/settings"] }
];

export const DEFAULT_ROUTE = "/";
