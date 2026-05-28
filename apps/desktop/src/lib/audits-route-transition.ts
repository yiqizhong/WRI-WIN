/** Audits Log ↔ report detail — opacity-only route crossfade (no transform). */

export const AUDIT_ROUTE_TRANSITION_EXIT_MS = 120;
export const AUDIT_ROUTE_TRANSITION_ENTER_MS = 240;
export const AUDIT_ROUTE_TRANSITION_EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

export function prefersReducedRouteMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
