import { useRef, useState } from "react";
import type { PasteTextConversation } from "@writer/contracts";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { formatProductDisplayName } from "@/lib/writer-product-display";

import { TextCopyChat } from "../text-copy-chat";
import { useWorkspace } from "../workspace-context";

export function TextCopyScreen() {
  const {
    daemonClient,
    daemonConnected,
    workspaceReady,
    workspaceProjectId,
    products,
    setSelectedProductId
  } = useWorkspace();

  const [pickedProductId, setPickedProductId] = useState<string | undefined>(undefined);
  const [conversation, setConversation] = useState<PasteTextConversation | null>(null);
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const productName = pickedProductId
    ? formatProductDisplayName(products.find((p) => p.id === pickedProductId)?.name ?? pickedProductId)
    : "General purpose";

  const pendingRewrite = conversation?.messages.some(
    (m) => m.role === "assistant" && m.status === "pending"
  );

  function withPendingGuard(action: () => void) {
    if (pendingRewrite) {
      pendingActionRef.current = action;
      setConfirmNewOpen(true);
      return;
    }
    action();
  }

  function handleChangeProduct(productId: string | undefined) {
    withPendingGuard(() => {
      setPickedProductId(productId);
      if (productId) void setSelectedProductId(productId);
      setConversation(null);
    });
  }

  function handleNewConversation() {
    withPendingGuard(() => {
      setConversation(null);
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {workspaceProjectId ? (
        <TextCopyChat
          client={daemonClient}
          daemonConnected={daemonConnected}
          workspaceReady={workspaceReady}
          projectId={workspaceProjectId}
          productId={pickedProductId}
          productName={productName}
          products={products}
          conversation={conversation}
          onConversationChange={setConversation}
          onRequestNewConversation={handleNewConversation}
          onChangeProduct={handleChangeProduct}
        />
      ) : (
        <p className="writer-type-body-compact writer-text-secondary p-4">Workspace is loading…</p>
      )}

      <Dialog open={confirmNewOpen} onOpenChange={setConfirmNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start over?</DialogTitle>
            <DialogDescription>
              A rewrite is still in progress. Starting over will discard the pending response.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmNewOpen(false)}>
              Keep waiting
            </Button>
            <Button
              type="button"
              onClick={() => {
                setConfirmNewOpen(false);
                pendingActionRef.current?.();
                pendingActionRef.current = null;
              }}
            >
              Start over
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
