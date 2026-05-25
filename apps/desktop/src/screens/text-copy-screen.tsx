import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

import { TextCopyChat } from "../text-copy-chat";
import { TextCopyProductPicker } from "../text-copy-product-picker";
import { useWorkspace } from "../workspace-context";

export function TextCopyScreen() {
  const navigate = useNavigate();
  const {
    daemonClient,
    daemonConnected,
    workspaceReady,
    workspaceProjectId,
    products,
    setSelectedProductId
  } = useWorkspace();

  const [chatStarted, setChatStarted] = useState(false);
  const [pickedProductId, setPickedProductId] = useState<string | undefined>(undefined);
  const [conversation, setConversation] = useState<PasteTextConversation | null>(null);
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);

  const auditLabel = useMemo(() => {
    if (!pickedProductId) {
      return "Company & software writing guidelines";
    }
    return products.find((product) => product.id === pickedProductId)?.name ?? pickedProductId;
  }, [pickedProductId, products]);

  const pendingRewrite = conversation?.messages.some(
    (message) => message.role === "assistant" && message.status === "pending"
  );

  async function startChat(productId?: string) {
    setPickedProductId(productId);
    if (productId) {
      await setSelectedProductId(productId);
    }
    setConversation(null);
    setChatStarted(true);
  }

  function resetConversation() {
    setConversation(null);
    setChatStarted(false);
    setPickedProductId(undefined);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="writer-home-text inline-flex w-fit shrink-0 items-center gap-2 rounded-md py-1 text-sm font-normal tracking-[0.08em] text-[#e5f1ff]/75 transition-colors hover:text-[#e5f1ff]"
          aria-label="Back to home"
        >
          <ArrowLeft className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
          Back
        </button>
        <h1 className="writer-home-text text-lg font-normal tracking-[0.08em] text-[#e5f1ff]">Text Copy</h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden">
        {!chatStarted ? (
          <TextCopyProductPicker
            products={products}
            onPick={(productId) => void startChat(productId)}
            onContinueWithoutProduct={() => void startChat()}
            onAddProduct={() => navigate("/settings?tab=guidelines")}
            disabled={!workspaceReady || !daemonConnected}
          />
        ) : workspaceProjectId ? (
          <TextCopyChat
            client={daemonClient}
            daemonConnected={daemonConnected}
            workspaceReady={workspaceReady}
            projectId={workspaceProjectId}
            productId={pickedProductId}
            productName={auditLabel}
            conversation={conversation}
            onConversationChange={setConversation}
            onRequestNewConversation={() => {
              if (pendingRewrite) {
                setConfirmNewOpen(true);
                return;
              }
              resetConversation();
            }}
          />
        ) : (
          <p className="writer-type-body-compact writer-text-secondary">Workspace is loading…</p>
        )}
      </div>

      <Dialog open={confirmNewOpen} onOpenChange={setConfirmNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new conversation?</DialogTitle>
            <DialogDescription>
              A rewrite is still in progress. Starting over will discard the pending response for this
              conversation.
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
                resetConversation();
              }}
            >
              New conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
