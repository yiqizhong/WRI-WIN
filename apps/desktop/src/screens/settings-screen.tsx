import { useSearchParams } from "react-router-dom";

import { WriterPageSubheader } from "@/components/writer/writer-page-subheader";
import {
  WriterSettingsTabs,
  isSettingsTab,
  type SettingsTab
} from "@/components/writer/writer-settings-tabs";

export function SettingsScreen() {
  const [searchParams] = useSearchParams();
  const fromQuery = searchParams.get("tab");
  const defaultTab: SettingsTab =
    fromQuery && isSettingsTab(fromQuery) ? fromQuery : "guidelines";

  return (
    <div className="writer-settings-page flex h-full min-h-0 flex-col overflow-hidden">
      <WriterPageSubheader title="Settings" backTo="/" backLabel="Return to home" />
      <div className="writer-settings-page__body flex min-h-0 flex-1 flex-col">
        <WriterSettingsTabs defaultTab={defaultTab} />
      </div>
    </div>
  );
}
