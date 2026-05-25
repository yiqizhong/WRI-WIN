export type NavItem = {
  label: string;
  path: string;
  title: string;
  description: string;
  matchPaths: string[];
};

export const NAV_ITEMS: NavItem[] = [];

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
