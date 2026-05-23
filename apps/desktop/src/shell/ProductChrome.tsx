import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Button,
  SideNav,
  SideNavItems,
  SideNavLink,
  Stack,
  Tag,
  Tile
} from "@carbon/react";
import { FolderOpen, Renew } from "@carbon/icons-react";

import { NAV_ITEMS } from "./nav-items";

export type DaemonFooterProps = {
  label: string;
  detail: string;
  tone: "ready" | "warning" | "offline" | "checking";
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

function tagType(tone: DaemonFooterProps["tone"]) {
  if (tone === "ready") {
    return "green" as const;
  }
  if (tone === "warning" || tone === "checking") {
    return "gray" as const;
  }
  return "red" as const;
}

export function ProductChrome({
  children,
  pageTitle,
  daemon,
  onOpenProject,
  openProjectDisabled,
  openProjectLoading
}: ProductChromeProps) {
  const location = useLocation();

  return (
    <div className="writer-product-chrome">
      <SideNav
        aria-label="Writer navigation"
        className="writer-product-chrome__nav"
        expanded
        isFixedNav={false}
        isChildOfHeader={false}
      >
        <SideNavItems>
          {NAV_ITEMS.map((item) => (
            <SideNavLink
              key={item.path}
              as={NavLink}
              to={item.path}
              end={item.path === "/"}
              isActive={item.matchPaths.includes(location.pathname)}
              renderIcon={() => null}
            >
              {item.label}
            </SideNavLink>
          ))}
        </SideNavItems>
        <div className="writer-product-chrome__footer">
          <Tile>
            <Stack gap={3}>
              <Tag type={tagType(daemon.tone)}>{daemon.label}</Tag>
              <p style={{ fontSize: "0.75rem", margin: 0, lineHeight: 1.4 }}>{daemon.detail}</p>
              <Button kind="ghost" size="sm" renderIcon={Renew} onClick={daemon.onRefresh}>
                Refresh
              </Button>
            </Stack>
          </Tile>
        </div>
      </SideNav>

      <Stack gap={7} className="writer-product-chrome__main" style={{ padding: "var(--cds-spacing-06)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "var(--cds-spacing-05)"
          }}
        >
          <h1 style={{ margin: 0, fontWeight: 300, fontSize: "1.75rem", lineHeight: 1.25 }}>{pageTitle}</h1>
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
