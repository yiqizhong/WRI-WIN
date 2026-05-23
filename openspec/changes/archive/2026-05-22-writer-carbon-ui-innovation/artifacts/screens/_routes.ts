import type { ComponentType } from "react";

import Review from "../../skeletons/Review";
import Sources from "../../skeletons/Sources";
import Agents from "../../skeletons/Agents";
import Settings from "../../skeletons/Settings";

export interface ScreenRoute {
  path: string;
  name: string;
  Component: ComponentType;
}

export const SCREEN_ROUTES: ScreenRoute[] = [
  { path: "/", name: "Review", Component: Review },
  { path: "/figma", name: "Sources", Component: Sources },
  { path: "/agents", name: "Agents", Component: Agents },
  { path: "/settings", name: "Settings", Component: Settings }
];

export { NAV_ITEMS, DEFAULT_ROUTE } from "./_shared/NavItems";
