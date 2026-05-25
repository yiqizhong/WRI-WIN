import type { ProductPackageListItem } from "@writer/contracts";

import { Button } from "@/components/ui/button";

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
      <div className={`flex flex-col gap-3 ${chatBubble}`}>
        <span className="writer-type-eyebrow">Assistant</span>
        <div className="writer-chat-message writer-chat-message--assistant">
          No product-specific guidelines are set up yet. You can still audit copy using company and software
          writing rules, or add a product in Guidelines for tighter product context.
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onContinueWithoutProduct} disabled={disabled}>
            Start audit
          </Button>
          <Button type="button" variant="outline" className="w-fit" onClick={onAddProduct} disabled={disabled}>
            Add product in Guidelines
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${chatBubble}`}>
      <span className="writer-type-eyebrow">Assistant</span>
      <div className="writer-chat-message writer-chat-message--assistant">
        Which product do you need to audit? Product-specific rules are optional — you can skip and use company
        and software writing guidelines only.
      </div>
      <div className="flex flex-col gap-2">
        {products.map((product) => (
          <Button
            key={product.id}
            type="button"
            variant="outline"
            className="w-fit justify-start"
            disabled={disabled}
            onClick={() => onPick(product.id)}
          >
            {product.name}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          className="w-fit justify-start"
          disabled={disabled}
          onClick={onContinueWithoutProduct}
        >
          Continue without product-specific guidelines
        </Button>
      </div>
    </div>
  );
}
