import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { WriterPageGrid, WriterPageGridHalf, WriterPageStack } from "../layout/writer-grid";
import { fillWidth, hugWidth } from "../layout/writer-sizing";
import { useWorkspace } from "../workspace-context";
import { WorkflowNotification } from "../workflow-notification";

export function SettingsScreen() {
  const workspace = useWorkspace();

  return (
    <WriterPageGrid gutterMode="wide" className="h-full">
      <WriterPageGridHalf>
        <WriterPageStack>
          <WorkflowNotification />

          <p className="text-sm text-muted-foreground">
            Optional tone notes applied to every audit alongside the selected product guidelines.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand-voice">Brand voice</Label>
            <Textarea
              id="brand-voice"
              className={fillWidth}
              rows={4}
              placeholder="Friendly, direct, no jargon."
              value={workspace.brandVoice}
              onChange={(event) => workspace.setBrandVoice(event.target.value)}
            />
          </div>

          <Button
            className={hugWidth}
            disabled={!workspace.workspaceReady}
            onClick={() => void workspace.saveBrandVoice()}
          >
            Save voice
          </Button>
        </WriterPageStack>
      </WriterPageGridHalf>
    </WriterPageGrid>
  );
}
