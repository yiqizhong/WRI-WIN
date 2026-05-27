import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

import { formatProductDisplayName } from "@/lib/writer-product-display";

import {
  WriterPageGrid,
  WriterPageGridFull,
  WriterPageGridHalf,
  WriterPageStack
} from "../layout/writer-grid";
import { WriterSectionHeader } from "../layout/writer-headings";
import { fillWidth, hugWidth, rowEnd, surfaceFillHeight } from "../layout/writer-sizing";
import { PasteTextChatPanel } from "../paste-text-chat-panel";
import { useWorkspace } from "../workspace-context";
import { WorkflowNotification } from "../workflow-notification";

export function SourcesScreen() {
  const workspace = useWorkspace();
  const navigate = useNavigate();

  const canAudit =
    workspace.workspaceReady &&
    Boolean(workspace.selectedProductId) &&
    workspace.figmaUrl.trim().length > 0;

  return (
    <WriterPageGrid gutterMode="narrow" equalRowHeight className="h-full">
      <WriterPageGridFull>
        <WorkflowNotification />
      </WriterPageGridFull>

      <WriterPageGridHalf fillHeight>
        <WriterPageGrid gutterMode="wide">
          <WriterPageGridFull>
            <Card className={surfaceFillHeight}>
              <CardContent className="flex flex-col gap-5 pt-6">
                <WriterSectionHeader
                  title="Figma audit"
                  description="Paste a frame link, choose the product, and run the audit."
                />

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="audit-product">Product</Label>
                  <Select
                    value={workspace.selectedProductId ?? ""}
                    onValueChange={(value) => {
                      if (value) {
                        void workspace.setSelectedProductId(value);
                      }
                    }}
                    disabled={!workspace.workspaceReady || workspace.products.length === 0}
                  >
                    <SelectTrigger id="audit-product" className={fillWidth}>
                      <SelectValue placeholder="Select product for this audit" />
                    </SelectTrigger>
                    <SelectContent>
                      {workspace.products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {formatProductDisplayName(product.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {workspace.products.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Add products under Guidelines before running an audit.
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="figma-url">Figma URL</Label>
                  <Input
                    id="figma-url"
                    className={fillWidth}
                    type="url"
                    placeholder="https://www.figma.com/design/…"
                    value={workspace.figmaUrl}
                    onChange={(event) => workspace.setFigmaUrl(event.target.value)}
                  />
                </div>

                {workspace.parsedFigmaScope ? (
                  <p className="writer-type-helper">Scope: {workspace.parsedFigmaScope}</p>
                ) : null}

                <div className={rowEnd}>
                  <Button
                    variant="ghost"
                    className={hugWidth}
                    disabled={!workspace.figmaUrl.trim()}
                    onClick={() => void workspace.connectFigma()}
                  >
                    Validate URL
                  </Button>
                  <Button
                    className={hugWidth}
                    disabled={!canAudit}
                    onClick={() => {
                      void (async () => {
                        const ok = await workspace.runFigmaAudit();
                        if (ok) {
                          navigate("/");
                        }
                      })();
                    }}
                  >
                    Run audit
                  </Button>
                </div>
              </CardContent>
            </Card>
          </WriterPageGridFull>
        </WriterPageGrid>
      </WriterPageGridHalf>

      <WriterPageGridHalf fillHeight>
        <PasteTextChatPanel client={workspace.daemonClient} daemonConnected={workspace.daemonConnected} />
      </WriterPageGridHalf>
    </WriterPageGrid>
  );
}
