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

import { WriterPageGrid, WriterPageGridFull } from "../layout/writer-grid";
import { hugWidth } from "../layout/writer-sizing";
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
  /** IBM Usage §Basic scaffolding — required leadspace description, never empty. */
  pageDescription: string;
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
  pageDescription,
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
              <p className="writer-type-helper">{daemon.detail}</p>
              <Button kind="ghost" size="sm" renderIcon={Renew} onClick={daemon.onRefresh}>
                Refresh
              </Button>
            </Stack>
          </Tile>
        </div>
      </SideNav>

      <Stack gap={7} className="writer-product-chrome__main">
        <div className="writer-product-chrome__content">
          <WriterPageGrid gutterMode="narrow">
            <WriterPageGridFull>
              <header className="writer-leadspace">
                <div className="writer-leadspace__body">
                  <h1 className="writer-type-page-title">{pageTitle}</h1>
                  <p className="writer-type-page-description">{pageDescription}</p>
                </div>
                <div className="writer-leadspace__actions">
                  <Button
                    kind="primary"
                    className={hugWidth}
                    renderIcon={FolderOpen}
                    disabled={openProjectDisabled}
                    onClick={onOpenProject}
                  >
                    {openProjectLoading ? "Opening…" : "Open project"}
                  </Button>
                </div>
              </header>
            </WriterPageGridFull>
          </WriterPageGrid>
          {children}
        </div>
      </Stack>
    </div>
  );
}
