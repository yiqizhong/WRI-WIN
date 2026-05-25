import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CreateFigmaSessionInput, FigmaAuditMode } from "@writer/contracts";

import { FigmaAuditWorkflowTabs, type WorkflowSubmitPayload } from "../figma-audit-workflow-tabs";
import { useWorkspace } from "../workspace-context";
import { DaemonClientError } from "../daemon-client";

const NONE_PRODUCT = "__none__";

export function FigmaAuditScreen() {
  const navigate = useNavigate();
  const {
    daemonClient,
    daemonConnected,
    workspaceReady,
    workspaceProjectId,
    products,
    setSelectedProductId
  } = useWorkspace();

  const [productId, setProductId] = useState<string>(NONE_PRODUCT);
  const [featureName, setFeatureName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<FigmaAuditMode>("single_frame");
  const [frameUrl, setFrameUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = !workspaceReady || !daemonConnected || submitting;

  async function startAudit(input: CreateFigmaSessionInput) {
    if (!workspaceProjectId) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (productId !== NONE_PRODUCT) {
        await setSelectedProductId(productId);
      }

      const session = await daemonClient.createFigmaSession(input);
      const audit = await daemonClient.runAudit(session.id);

      if (audit.diagnostic) {
        setError(audit.diagnostic.message);
        navigate(`/audits/${session.id}`);
        return;
      }

      navigate(`/audits/${session.id}`);
    } catch (submitError) {
      setError(submitError instanceof DaemonClientError ? submitError.message : "Could not start Figma audit.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSingleFrame() {
    if (!workspaceProjectId || !featureName.trim() || !description.trim() || !frameUrl.trim()) {
      setError("Feature name, description, and frame URL are required.");
      return;
    }

    await startAudit({
      mode: "single_frame",
      projectId: workspaceProjectId,
      productId: productId === NONE_PRODUCT ? undefined : productId,
      featureName: featureName.trim(),
      description: description.trim(),
      url: frameUrl.trim()
    });
  }

  async function submitWorkflow(payload: WorkflowSubmitPayload) {
    if (!workspaceProjectId || !featureName.trim() || !description.trim()) {
      setError("Feature name and description are required.");
      return;
    }

    await startAudit({
      mode: "workflow",
      projectId: workspaceProjectId,
      productId: productId === NONE_PRODUCT ? undefined : productId,
      featureName: featureName.trim(),
      description: description.trim(),
      fileKey: payload.fileKey,
      nodeIds: payload.nodeIds
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="writer-home-text inline-flex items-center gap-2 text-sm text-[#e5f1ff]/75 hover:text-[#e5f1ff]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </button>
        <h1 className="writer-home-text text-lg text-[#e5f1ff]">Figma Audit</h1>
      </div>

      <div className="grid max-w-3xl gap-4">
        <div className="grid gap-2">
          <Label htmlFor="figma-product">Product (optional)</Label>
          <Select
            value={productId}
            onValueChange={(value) => setProductId(value ?? NONE_PRODUCT)}
            disabled={disabled}
          >
            <SelectTrigger id="figma-product">
              <SelectValue placeholder="Select product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_PRODUCT}>(none)</SelectItem>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="figma-feature">Feature name</Label>
          <Input
            id="figma-feature"
            value={featureName}
            disabled={disabled}
            onChange={(event) => setFeatureName(event.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="figma-description">Description</Label>
          <Textarea
            id="figma-description"
            value={description}
            disabled={disabled}
            rows={4}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "single_frame" ? "default" : "secondary"}
            disabled={disabled}
            onClick={() => setMode("single_frame")}
          >
            Single frame
          </Button>
          <Button
            type="button"
            variant={mode === "workflow" ? "default" : "secondary"}
            disabled={disabled}
            onClick={() => setMode("workflow")}
          >
            Workflow
          </Button>
        </div>

        {mode === "single_frame" ? (
          <div className="grid gap-2">
            <Label htmlFor="figma-frame-url">Frame URL</Label>
            <Input
              id="figma-frame-url"
              value={frameUrl}
              disabled={disabled}
              placeholder="https://www.figma.com/design/..."
              onChange={(event) => setFrameUrl(event.target.value)}
            />
            <Button type="button" disabled={disabled} onClick={() => void submitSingleFrame()}>
              Start audit
            </Button>
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-col gap-3">
            <FigmaAuditWorkflowTabs
              disabled={disabled}
              onParseUrl={(url) => daemonClient.parseFigmaUrl(url)}
              onListPageFrames={(pageUrl) => daemonClient.listPageFrames(pageUrl)}
              onSubmit={(payload) => void submitWorkflow(payload)}
            />
          </div>
        )}
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
