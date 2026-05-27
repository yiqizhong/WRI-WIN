import { WriterModal } from "@/components/writer/writer-modal";

type AuditDetailRuleModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layerLabel: string;
  content: string;
};

export function AuditDetailRuleModal({ open, onOpenChange, layerLabel, content }: AuditDetailRuleModalProps) {
  return (
    <WriterModal
      open={open}
      onOpenChange={onOpenChange}
      title={layerLabel}
      description="Guideline excerpt captured at audit time."
    >
      <pre className="whitespace-pre-wrap text-sm text-[#e5f1ff]/90">{content}</pre>
    </WriterModal>
  );
}
