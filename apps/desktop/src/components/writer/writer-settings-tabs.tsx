import { useCallback, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";

import { AgentsScreen } from "@/screens/agents-screen";
import { GuidelinesScreen } from "@/screens/guidelines-screen";

import {
  WRITER_MINIMAL_TAB_TRIGGER_CLASS,
  WriterMinimalTabsList
} from "./writer-minimal-tabs";

const SETTINGS_TABS = ["guidelines", "agents"] as const;
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
      className="writer-page-subheader-content-gap flex min-h-0 flex-1 flex-col gap-6"
    >
      <WriterMinimalTabsList>
        <TabsTrigger value="guidelines" className={WRITER_MINIMAL_TAB_TRIGGER_CLASS}>
          Writing Guidelines
        </TabsTrigger>
        <TabsTrigger value="agents" className={WRITER_MINIMAL_TAB_TRIGGER_CLASS}>
          LLM & MCP
        </TabsTrigger>
      </WriterMinimalTabsList>

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
