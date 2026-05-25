import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

type AuditDetailRuleModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layerLabel: string;
  content: string;
};

export function AuditDetailRuleModal({ open, onOpenChange, layerLabel, content }: AuditDetailRuleModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{layerLabel}</DialogTitle>
          <DialogDescription>Guideline excerpt captured at audit time.</DialogDescription>
        </DialogHeader>
        <pre className="whitespace-pre-wrap text-sm text-[#e5f1ff]/90">{content}</pre>
      </DialogContent>
    </Dialog>
  );
}
