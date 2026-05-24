import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

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
  pageDescription: string;
  daemon: DaemonFooterProps;
};

function daemonBadgeVariant(tone: DaemonFooterProps["tone"]) {
  if (tone === "ready") return "default" as const;
  if (tone === "offline") return "destructive" as const;
  return "secondary" as const;
}

export function ProductChrome({ children, pageTitle, pageDescription, daemon }: ProductChromeProps) {
  const location = useLocation();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <SidebarProvider className="flex h-full min-h-0 flex-1 overflow-hidden !bg-transparent has-data-[variant=inset]:!bg-transparent">
        <Sidebar variant="sidebar" collapsible="icon" className="border-0 bg-transparent shadow-none">
          <SidebarHeader className="writer-window-drag px-4 py-3">
            <span className="text-sm font-semibold tracking-tight">Writer</span>
            <span className="text-xs text-muted-foreground">Local copy review</span>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        render={<NavLink to={item.path} end={item.path === "/"} />}
                        isActive={item.matchPaths.includes(location.pathname)}
                        tooltip={item.label}
                      >
                        {item.label}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="space-y-2 px-4 pb-4">
            <Badge variant={daemonBadgeVariant(daemon.tone)}>{daemon.label}</Badge>
            <p className="text-xs text-muted-foreground leading-relaxed">{daemon.detail}</p>
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={daemon.onRefresh}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="writer-app-main flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent shadow-none md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:rounded-none md:peer-data-[variant=inset]:bg-transparent md:peer-data-[variant=inset]:shadow-none">
          <header className="writer-page-header writer-window-drag shrink-0 px-6 py-5">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">{pageTitle}</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">{pageDescription}</p>
            </div>
          </header>
          <div className={cn("writer-app-main__body flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-5")}>
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
