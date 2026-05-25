import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { FigmaAuditPageBrowser } from "./figma-audit-page-browser";
import { FigmaAuditPasteLinks } from "./figma-audit-paste-links";

export type WorkflowSubmitPayload = {
  fileKey: string;
  nodeIds: string[];
};

type FigmaAuditWorkflowTabsProps = {
  disabled?: boolean;
  onSubmit: (payload: WorkflowSubmitPayload) => void;
  onParseUrl: (url: string) => Promise<{ fileKey: string; nodeId?: string; suggestedScope: { fileKey: string } }>;
  onListPageFrames: (pageUrl: string) => Promise<import("@writer/contracts").ListPageFramesResponse>;
};

export function FigmaAuditWorkflowTabs({
  disabled,
  onSubmit,
  onParseUrl,
  onListPageFrames
}: FigmaAuditWorkflowTabsProps) {
  return (
    <Tabs defaultValue="paste-links" className="flex min-h-0 flex-1 flex-col gap-4">
      <TabsList>
        <TabsTrigger value="paste-links">Paste links</TabsTrigger>
        <TabsTrigger value="browse-page">Browse page</TabsTrigger>
      </TabsList>
      <TabsContent value="paste-links" className="min-h-0 flex-1">
        <FigmaAuditPasteLinks disabled={disabled} onSubmit={onSubmit} onParseUrl={onParseUrl} />
      </TabsContent>
      <TabsContent value="browse-page" className="min-h-0 flex-1">
        <FigmaAuditPageBrowser
          disabled={disabled}
          onSubmit={onSubmit}
          onListPageFrames={onListPageFrames}
        />
      </TabsContent>
    </Tabs>
  );
}
