import { RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useWorkspace } from "../workspace-context";
import { AgentsScreen } from "./agents-screen";
import { BrandVoiceSettings } from "./settings-brand-voice";
import { GuidelinesScreen } from "./guidelines-screen";
import { ReviewScreen } from "./review-screen";
import { SourcesScreen } from "./sources-screen";

function daemonBadgeVariant(tone: "ready" | "warning" | "offline" | "checking") {
  if (tone === "ready") return "default" as const;
  if (tone === "offline") return "destructive" as const;
  return "secondary" as const;
}

export function SettingsScreen() {
  const workspace = useWorkspace();
  const { statusView } = workspace;
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") ?? "review";

  return (
    <Tabs defaultValue={defaultTab} className="flex h-full min-h-0 flex-col">
      <TabsList className="mx-6 mt-1 shrink-0 self-start">
        <TabsTrigger value="review">Review</TabsTrigger>
        <TabsTrigger value="sources">Sources</TabsTrigger>
        <TabsTrigger value="guidelines">Guidelines</TabsTrigger>
        <TabsTrigger value="agents">Agents</TabsTrigger>
        <TabsTrigger value="brand-voice">Brand voice</TabsTrigger>
        <TabsTrigger value="system">System</TabsTrigger>
      </TabsList>

      <TabsContent value="review" className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-5">
        <ReviewScreen />
      </TabsContent>
      <TabsContent value="sources" className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-5">
        <SourcesScreen />
      </TabsContent>
      <TabsContent value="guidelines" className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-5">
        <GuidelinesScreen />
      </TabsContent>
      <TabsContent value="agents" className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-5">
        <AgentsScreen />
      </TabsContent>
      <TabsContent value="brand-voice" className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-5">
        <BrandVoiceSettings />
      </TabsContent>
      <TabsContent value="system" className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-5 pt-4">
        <div className="flex flex-col gap-3">
          <Badge variant={daemonBadgeVariant(statusView.tone)} className="w-fit">
            {statusView.label}
          </Badge>
          <p className="text-sm text-muted-foreground leading-relaxed">{statusView.detail}</p>
          <Button
            variant="ghost"
            size="sm"
            className="w-fit justify-start"
            onClick={() => void workspace.refreshDaemonStatus()}
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}
