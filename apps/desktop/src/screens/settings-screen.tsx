import { ArrowLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AgentsScreen } from "./agents-screen";
import { GuidelinesScreen } from "./guidelines-screen";
import { ReviewScreen } from "./review-screen";
import { SourcesScreen } from "./sources-screen";

const SETTINGS_TABS = ["review", "sources", "guidelines", "agents"] as const;

export function SettingsScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromQuery = searchParams.get("tab");
  const defaultTab =
    fromQuery && (SETTINGS_TABS as readonly string[]).includes(fromQuery) ? fromQuery : "review";

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <button
        type="button"
        onClick={() => navigate("/")}
        className="writer-home-text inline-flex w-fit shrink-0 items-center gap-2 rounded-md py-1 text-sm font-normal tracking-[0.08em] text-[#e5f1ff]/75 transition-colors hover:text-[#e5f1ff]"
        aria-label="Back to home"
      >
        <ArrowLeft className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
        Back
      </button>

      <Tabs defaultValue={defaultTab} className="flex min-h-0 flex-1 flex-col gap-6">
        <TabsList variant="minimal" className="shrink-0 w-full">
          <TabsTrigger value="review">Review</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="guidelines">Guidelines</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="flex min-h-0 flex-1 flex-col overflow-hidden pb-5">
          <ReviewScreen />
        </TabsContent>
        <TabsContent value="sources" className="flex min-h-0 flex-1 flex-col overflow-hidden pb-5">
          <SourcesScreen />
        </TabsContent>
        <TabsContent value="guidelines" className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto pb-5">
          <GuidelinesScreen />
        </TabsContent>
        <TabsContent value="agents" className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto pb-5">
          <AgentsScreen />
        </TabsContent>
      </Tabs>
    </div>
  );
}
