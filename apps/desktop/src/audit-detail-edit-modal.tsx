import { useEffect, useState } from "react";

import { WriterModal } from "@/components/writer/writer-modal";
import { WriterFormTextarea } from "@/components/writer/writer-form-field";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";
import { WriterPageStack } from "@/layout/writer-grid";
import { WriterHomeDivider } from "@/layout/writer-headings";
import { useModalLatch } from "@/lib/use-modal-latch";

type AuditDetailEditModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  original: string;
  aiSuggestion: string;
  value: string;
  onSave: (value: string) => void;
};

export function AuditDetailEditModal({
  open,
  onOpenChange,
  original,
  aiSuggestion,
  value,
  onSave
}: AuditDetailEditModalProps) {
  const [draft, setDraft] = useState(value);
  const latchedOriginal = useModalLatch(open, original);
  const latchedAiSuggestion = useModalLatch(open, aiSuggestion);

  // Reset the editable draft each time the modal opens with new source data.
  useEffect(() => {
    if (!open) return;
    setDraft(value);
  }, [open, value]);

  return (
    <WriterModal
      open={open}
      onOpenChange={onOpenChange}
      title="Your edit"
      footer={
        <WriterPrimaryButton
          type="button"
          onClick={() => {
            onSave(draft);
            onOpenChange(false);
          }}
        >
          Save
        </WriterPrimaryButton>
      }
    >
      <WriterPageStack gap={4}>
        <section className="flex flex-col gap-1">
          <h3 className="writer-home-text writer-home-section-title m-0">Original</h3>
          <p className="writer-home-text m-0 text-[18px] leading-[1.45]" style={{ color: "#c7d4e6" }}>
            {latchedOriginal}
          </p>
        </section>

        <WriterHomeDivider />

        <section className="flex flex-col gap-1">
          <h3 className="writer-home-text writer-home-section-title m-0">AI suggestion</h3>
          <p className="writer-home-text m-0 text-[18px] leading-[1.45]" style={{ color: "#c7d4e6" }}>
            {latchedAiSuggestion}
          </p>
        </section>

        <WriterHomeDivider />

        <section>
          <h3 className="writer-home-text writer-home-section-title m-0">Your edit</h3>
          <WriterFormTextarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={5}
            className="resize-y text-[1.0625rem] leading-[1.55]"
            shellClassName="mt-2 min-h-[164px]"
          />
        </section>
      </WriterPageStack>
    </WriterModal>
  );
}
