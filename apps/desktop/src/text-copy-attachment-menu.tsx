import { FileText, Plus, Sheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export type PasteTextAttachmentKind = "spreadsheet" | "plain_text";

type TextCopyAttachmentMenuProps = {
  disabled?: boolean;
  attaching?: boolean;
  onAttach: (kind: PasteTextAttachmentKind) => void;
};

export function attachmentKindFromPath(filePath: string): PasteTextAttachmentKind {
  const extension = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "csv" || extension === "xlsx" || extension === "xls") {
    return "spreadsheet";
  }
  return "plain_text";
}

export function TextCopyAttachmentMenu({
  disabled = false,
  attaching = false,
  onAttach
}: TextCopyAttachmentMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Attach file"
            disabled={disabled || attaching}
          >
            <Plus className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => onAttach("spreadsheet")} disabled={disabled || attaching}>
          <Sheet className="size-4" />
          Attach spreadsheet
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAttach("plain_text")} disabled={disabled || attaching}>
          <FileText className="size-4" />
          Attach text file
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
