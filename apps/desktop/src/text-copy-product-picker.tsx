import type { ProductPackageListItem } from "@writer/contracts";

import { Button } from "@/components/ui/button";
import { GuidelineRowCard } from "@/components/writer/guideline-row-card";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";

import { WriterSectionHeader } from "./layout/writer-headings";
import { chatBubble } from "./layout/writer-sizing";

type TextCopyProductPickerProps = {
  products: ProductPackageListItem[];
  onPick: (productId: string) => void;
  onContinueWithoutProduct: () => void;
  onAddProduct: () => void;
  disabled?: boolean;
};

export function TextCopyProductPicker({
  products,
  onPick,
  onContinueWithoutProduct,
  onAddProduct,
  disabled = false
}: TextCopyProductPickerProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <WriterSectionHeader
          title="Get started"
          description="No product-specific guidelines yet. You can still audit with company and software writing rules."
        />
        <div className={`flex flex-col gap-3 ${chatBubble}`}>
          <span className="writer-type-eyebrow">Assistant</span>
          <div className="writer-chat-message writer-chat-message--assistant">
            No product-specific guidelines are set up yet. You can still audit copy using company and software
            writing rules, or add a product in Guidelines for tighter product context.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <WriterPrimaryButton type="button" onClick={onAddProduct} disabled={disabled}>
            Add product in Guidelines
          </WriterPrimaryButton>
          <Button type="button" variant="ghost" className="w-fit" onClick={onContinueWithoutProduct} disabled={disabled}>
            Start audit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <WriterSectionHeader
        title="Choose product"
        description="Product-specific rules are optional — skip to use company and software writing guidelines only."
      />
      <div className={`flex flex-col gap-3 ${chatBubble}`}>
        <span className="writer-type-eyebrow">Assistant</span>
        <div className="writer-chat-message writer-chat-message--assistant">
          Which product do you need to audit? Pick a product below or continue without product-specific
          guidelines.
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {products.map((product) => (
          <GuidelineRowCard
            key={product.id}
            title={product.name}
            subtitle={product.id}
            onOpen={() => onPick(product.id)}
          />
        ))}
        <Button
          type="button"
          variant="ghost"
          className="writer-home-text w-fit justify-start text-sm text-[#e5f1ff]/85"
          disabled={disabled}
          onClick={onContinueWithoutProduct}
        >
          Skip — use company rules only
        </Button>
      </div>
    </div>
  );
}
