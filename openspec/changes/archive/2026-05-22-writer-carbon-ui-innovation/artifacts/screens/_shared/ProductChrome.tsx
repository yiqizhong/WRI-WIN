// artifacts/screens/_shared/ProductChrome.tsx
// Architect output · Pass 3 reconciled

/**
 * Intent:
 * - Persistent sidebar for 4 areas (TaskBreakdown D1 · Persistence Over Discovery)
 * - SideNav active = layer selected, NOT accent (restraint L01)
 * - Daemon status tile pinned to sidebar footer (D4 · L04 inline diagnostics)
 * - Header: page title + single primary "Open Project" (D7 · accent budget 1)
 * - Renders INSIDE seed AppShell <main> — position relative, NOT fixed Header
 *
 * Builder must not:
 * - Override seed AppShell or use fixed Carbon Header at y=0
 * - Add second primary button in header
 *
 * Builder must:
 * - Wire NavLink to MemoryRouter paths from NavItems.ts
 * - Pass daemonStatus + onRefresh + onOpenProject props from App shell
 */

import type { ReactNode } from "react";
import {
  Button,
  SideNav,
  SideNavItems,
  SideNavLink,
  Stack,
  Tag,
  Tile
} from "@carbon/react";
import { FolderOpen } from "@carbon/icons-react";

import { NAV_ITEMS } from "./NavItems";

export type DaemonFooterProps = {
  label: string;
  detail: string;
  tone: "ready" | "warning" | "offline";
  onRefresh: () => void;
};

export type ProductChromeProps = {
  children: ReactNode;
  pageTitle: string;
  daemon: DaemonFooterProps;
  onOpenProject: () => void;
  openProjectDisabled?: boolean;
  openProjectLoading?: boolean;
};

export default function ProductChrome({
  children,
  pageTitle,
  daemon,
  onOpenProject,
  openProjectDisabled,
  openProjectLoading
}: ProductChromeProps) {
  return (
    <div
      className="writer-product-chrome"
      style={{ display: "flex", minHeight: "calc(100vh - 66px)" }}
    >
      <SideNav
        aria-label="Writer"
        expanded
        isFixedNav={false}
        style={{ width: 256, flexShrink: 0 }}
      >
        <SideNavItems>
          {NAV_ITEMS.map((item) => (
            <SideNavLink key={item.path} href={item.path} renderIcon={() => null}>
              {item.label}
            </SideNavLink>
          ))}
        </SideNavItems>

        {/* @builder: SideNavLink must use React Router NavLink or onClick navigate — not full page href */}

        <div style={{ marginTop: "auto", padding: "var(--cds-spacing-05)" }}>
          <Tile style={{ padding: "var(--cds-spacing-05)" }}>
            <Stack gap={3}>
              <Tag type={daemon.tone === "ready" ? "green" : daemon.tone === "warning" ? "gray" : "red"}>
                {daemon.label}
              </Tag>
              <p style={{ fontSize: "0.75rem", margin: 0 }}>{daemon.detail}</p>
              <Button kind="ghost" size="sm" onClick={daemon.onRefresh}>
                Refresh
              </Button>
            </Stack>
          </Tile>
        </div>
      </SideNav>

      <Stack gap={7} style={{ flex: 1, padding: "var(--cds-spacing-06)", minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "var(--cds-spacing-05)"
          }}
        >
          <h1 style={{ margin: 0, fontWeight: 300, fontSize: "1.75rem" }}>{pageTitle}</h1>
          <Button
            kind="primary"
            renderIcon={FolderOpen}
            disabled={openProjectDisabled}
            onClick={onOpenProject}
          >
            {openProjectLoading ? "Opening…" : "Open project"}
          </Button>
        </div>
        {children}
      </Stack>
    </div>
  );
}
