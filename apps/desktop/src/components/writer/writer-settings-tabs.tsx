import { useCallback, useState, type ReactNode } from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { useSearchParams } from "react-router-dom";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { AgentsScreen } from "@/screens/agents-screen";
import { GuidelinesScreen } from "@/screens/guidelines-screen";

const SETTINGS_TABS = ["guidelines", "agents"] as const;

const SETTINGS_TAB_TRIGGER_CLASS = cn(
  "transition-none",
  "group-data-[variant=minimal]/tabs-list:!text-[rgb(229_241_255/58%)]",
  "dark:group-data-[variant=minimal]/tabs-list:!text-[rgb(229_241_255/58%)]",
  "group-data-[variant=minimal]/tabs-list:hover:!text-[rgb(229_241_255/82%)]",
  "dark:group-data-[variant=minimal]/tabs-list:hover:!text-[rgb(229_241_255/82%)]",
  "group-data-[variant=minimal]/tabs-list:data-active:!text-[var(--writer-accent-blue)]",
  "dark:group-data-[variant=minimal]/tabs-list:data-active:!text-[var(--writer-accent-blue)]",
  "group-data-[variant=minimal]/tabs-list:data-active:hover:!text-[var(--writer-accent-blue)]",
  "dark:group-data-[variant=minimal]/tabs-list:data-active:hover:!text-[var(--writer-accent-blue)]"
);
type SettingsTab = (typeof SETTINGS_TABS)[number];

function isSettingsTab(value: string): value is SettingsTab {
  return (SETTINGS_TABS as readonly string[]).includes(value);
}

export function WriterSettingsTabs({ defaultTab }: { defaultTab: SettingsTab }) {
  const [, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<SettingsTab>(defaultTab);

  const handleTabChange = useCallback(
    (next: string | null) => {
      if (!next || !isSettingsTab(next) || next === tab) {
        return;
      }

      setTab(next);
      setSearchParams(
        (params) => {
          const updated = new URLSearchParams(params);
          updated.set("tab", next);
          return updated;
        },
        { replace: true }
      );
    },
    [setSearchParams, tab]
  );

  return (
    <Tabs
      value={tab}
      onValueChange={handleTabChange}
      className="flex min-h-0 flex-1 flex-col gap-6 pt-2"
    >
      <TabsList variant="minimal" className="writer-settings-tabs-list relative z-[1] shrink-0 max-w-full">
        <TabsTrigger value="guidelines" className={SETTINGS_TAB_TRIGGER_CLASS}>
          Writing Guidelines
        </TabsTrigger>
        <TabsTrigger value="agents" className={SETTINGS_TAB_TRIGGER_CLASS}>
          LLM & MCP
        </TabsTrigger>
        <TabsPrimitive.Indicator className="writer-settings-tab-indicator" />
      </TabsList>

      <div className="writer-settings-panels relative min-h-0 flex-1 overflow-hidden">
        <SettingsTabPanel value="guidelines">
          <GuidelinesScreen />
        </SettingsTabPanel>
        <SettingsTabPanel value="agents">
          <AgentsScreen />
        </SettingsTabPanel>
      </div>
    </Tabs>
  );
}

function SettingsTabPanel({ value, children }: { value: SettingsTab; children: ReactNode }) {
  return (
    <TabsContent
      value={value}
      keepMounted
      className="writer-settings-tab-panel flex min-h-0 flex-1 flex-col overflow-hidden pb-5"
    >
      {children}
    </TabsContent>
  );
}

export { SETTINGS_TABS, isSettingsTab, type SettingsTab };
