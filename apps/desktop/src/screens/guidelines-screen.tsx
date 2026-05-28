import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import type { GuidelinesTree } from "@writer/contracts";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  collectNewProductFiles,
  EMPTY_NEW_PRODUCT_FILE_SLOTS,
  productSlotFilename,
  type NewProductFileSlots,
  type StagedGuidelineFile
} from "@/lib/guideline-upload-display";
import { GlassCard } from "@/components/writer/glass-card";
import { formatProductDisplayName } from "@/lib/writer-product-display";
import { WRITER_MODAL_MOTION_DURATION_MS } from "@/lib/writer-modal-motion";
import { WriterModal } from "@/components/writer/writer-modal";
import { GuidelineFileRow, GuidelineRowCard } from "@/components/writer/guideline-row-card";
import { InlineAlert } from "@/components/writer/inline-alert";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";
import { cn } from "@/lib/utils";

import { DaemonClientError } from "../daemon-client";
import { WriterPageGrid, WriterPageGridHalf, WriterPageStack } from "../layout/writer-grid";
import { WriterHomeDivider, WriterSectionHeader } from "../layout/writer-headings";
import { useWorkspace } from "../workspace-context";

type PendingUpload = {
  label: string;
  exists: boolean;
  run: (overwrite: boolean) => Promise<void>;
};

function DropZone({
  label,
  hint,
  accept,
  multiple,
  onFiles,
  disabled,
  fileInputRef: externalFileInputRef
}: {
  label: string;
  hint: string;
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  disabled: boolean;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const internalFileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = externalFileInputRef ?? internalFileInputRef;
  const ownsFileInput = externalFileInputRef == null;
  const [over, setOver] = useState(false);

  const onPaste = useCallback(
    async (e: React.ClipboardEvent) => {
      if (disabled) return;
      const items = e.clipboardData.items;
      const files: File[] = [];
      for (const item of items) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) files.push(f);
        } else if (item.kind === "string" && item.type === "text/plain") {
          const text = await new Promise<string>((resolve) => item.getAsString(resolve));
          if (text.trim().length > 0) {
            files.push(new File([text], `pasted-${Date.now()}.md`, { type: "text/markdown" }));
          }
        }
      }
      if (files.length) onFiles(files);
    },
    [disabled, onFiles]
  );

  return (
    <div
      tabIndex={0}
      onPaste={onPaste}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (disabled) return;
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
      }}
      onClick={() => !disabled && fileInputRef.current?.click()}
      className={cn(
        "rounded-[2px] border border-dashed p-6 text-center transition-colors",
        over ? "border-primary bg-accent/40" : "border-border bg-card",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      )}
    >
      <div className="mb-1 font-semibold">{label}</div>
      <div className="text-sm text-muted-foreground">{hint}</div>
      {ownsFileInput ? (
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) onFiles(files);
            e.target.value = "";
          }}
        />
      ) : null}
    </div>
  );
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function glossaryFormatFromFilename(filename: string): "csv" | "md" | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".md")) return "md";
  return null;
}

function isConflictError(err: unknown): boolean {
  return err instanceof DaemonClientError && err.code === "conflict";
}

export function GuidelinesScreen() {
  const workspace = useWorkspace();
  const client = workspace.daemonClient;
  const connected = workspace.daemonConnected;

  const [tree, setTree] = useState<GuidelinesTree | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [overwritePending, setOverwritePending] = useState<PendingUpload | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [productDetailId, setProductDetailId] = useState<string | null>(null);
  const [productDetailOpen, setProductDetailOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [newProductId, setNewProductId] = useState("");
  const [newProductSlots, setNewProductSlots] = useState<NewProductFileSlots>(EMPTY_NEW_PRODUCT_FILE_SLOTS);

  const load = useCallback(async () => {
    if (!connected) return;
    setError(null);
    try {
      const t = await client.getGuidelinesTree();
      setTree(t);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load.";
      if (/expected object|expected array|expected boolean/i.test(msg)) {
        setError(
          "Guidelines data format mismatch. Restart the Writer daemon (npm run dev:daemon) so it matches this app version, then reload."
        );
      } else {
        setError(msg);
      }
    }
  }, [client, connected]);

  useEffect(() => {
    void load();
  }, [load]);

  const runUpload = useCallback(
    async (pending: PendingUpload, overwrite: boolean) => {
      setBusy(true);
      setError(null);
      try {
        await pending.run(overwrite);
        setOverwritePending(null);
        await load();
      } catch (err) {
        if (!overwrite && isConflictError(err)) {
          setOverwritePending(pending);
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const queueUpload = useCallback(
    (label: string, exists: boolean, run: (overwrite: boolean) => Promise<void>) => {
      const pending: PendingUpload = { label, exists, run };
      if (exists) {
        setOverwritePending(pending);
        return;
      }
      void runUpload(pending, false);
    },
    [runUpload]
  );

  const handleCompanyBaseFiles = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      const content = await readFileAsText(file);
      queueUpload("Company base", Boolean(tree?.companyBase), async (overwrite) => {
        await client.uploadCompanyBase({ content, overwrite, sourceFilename: file.name });
      });
    },
    [client, queueUpload, tree?.companyBase]
  );

  const handleSoftwareWritingFiles = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      const content = await readFileAsText(file);
      queueUpload("Software writing", Boolean(tree?.softwareWriting), async (overwrite) => {
        await client.uploadSoftwareWriting({ content, overwrite, sourceFilename: file.name });
      });
    },
    [client, queueUpload, tree?.softwareWriting]
  );

  const handleRemoveCompanyBase = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await client.deleteCompanyBase();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [client, load]);

  const handleRemoveSoftwareWriting = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await client.deleteSoftwareWriting();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [client, load]);

  const stageNewProductSlot = useCallback(async (slot: keyof NewProductFileSlots, files: File[]) => {
    const file = files[0];
    if (!file) return;
    const staged: StagedGuidelineFile = { filename: file.name, content: await readFileAsText(file) };
    setNewProductSlots((prev) => ({ ...prev, [slot]: staged }));
  }, []);

  const submitAddProduct = useCallback(async () => {
    const id = newProductId.trim().replace(/[^a-zA-Z0-9-_]/g, "-");
    const files = collectNewProductFiles(newProductSlots);
    if (!id) {
      setError("Product name is required.");
      return;
    }
    if (files.length === 0) {
      setError("Add at least one file (product background, glossary, or writing guide).");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await client.createProduct({ id, files });
      setAddProductOpen(false);
      setNewProductId("");
      setNewProductSlots(EMPTY_NEW_PRODUCT_FILE_SLOTS);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [client, load, newProductSlots, newProductId]);

  const confirmDeleteProduct = useCallback(async () => {
    if (!deleteProductId) return;
    setBusy(true);
    setError(null);
    try {
      await client.deleteProduct(deleteProductId);
      setDeleteProductId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [client, deleteProductId, load]);

  const activeProduct = tree?.products.find((item) => item.id === productDetailId) ?? null;

  return (
    <WriterPageStack gap={4}>
      {error ? (
        <InlineAlert kind="error" title="Error" subtitle={error} onClose={() => setError(null)} />
      ) : null}
      {tree?.conflictError ? (
        <InlineAlert kind="error" title="Guideline conflict" subtitle={tree.conflictError} />
      ) : null}

      <WriterPageGrid className="writer-settings-guidelines-grid min-h-0 w-full grid-cols-1 auto-rows-min gap-10 overflow-visible lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-x-14 lg:gap-y-8">
        <WriterPageGridHalf>
            <WriterPageStack gap={9}>
              <UploadSlotSection
                title="Company base"
                description="Global guidelines applied to every product review."
                filled={Boolean(tree?.companyBase)}
                uploadedFileName={productSlotFilename(
                  Boolean(tree?.companyBase),
                  tree?.companyBaseFilename,
                  "company-base.md"
                )}
                dropLabel="Drop company-base.md here"
                dropHint="or click to browse · paste markdown"
                accept=".md,text/markdown"
                onFiles={handleCompanyBaseFiles}
                onRemove={() => void handleRemoveCompanyBase()}
                busy={busy}
                connected={connected}
              />

              <UploadSlotSection
                title="Software writing"
                description="Shared writing standards across all SW product lines."
                filled={Boolean(tree?.softwareWriting)}
                uploadedFileName={productSlotFilename(
                  Boolean(tree?.softwareWriting),
                  tree?.softwareWritingFilename,
                  "software-writing.md"
                )}
                dropLabel="Drop software-writing.md here"
                dropHint="or click to browse · paste markdown"
                accept=".md,text/markdown"
                onFiles={handleSoftwareWritingFiles}
                onRemove={() => void handleRemoveSoftwareWriting()}
                busy={busy}
                connected={connected}
              />
            </WriterPageStack>
          </WriterPageGridHalf>

        <div
          role="presentation"
          aria-hidden
          className="writer-home-divider-vertical hidden justify-self-center self-start lg:block"
        />

        <WriterPageGridHalf>
          <WriterPageStack gap={3}>
              <WriterSectionHeader
                title="Products"
                description="Product background, glossary, and guides per product."
                actions={
                  <Button
                    type="button"
                    variant="ghost"
                    className="writer-pill-ghost writer-pill-add"
                    disabled={busy || !connected}
                    aria-label="Add product"
                    onClick={() => setAddProductOpen(true)}
                  >
                    <Plus className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                    <span>Add</span>
                  </Button>
                }
              />

              {tree && tree.products.length === 0 ? (
                <div
                  className="rounded-[2px] border border-dashed border-border bg-card p-6 text-center"
                  aria-label="No products yet"
                >
                  <div className="font-semibold text-foreground">No products yet</div>
                </div>
              ) : null}

              <WriterPageStack gap={3}>
                {tree?.products.map((item) => (
                  <GuidelineRowCard
                    key={item.id}
                    title={formatProductDisplayName(item.id)}
                    onOpen={() => {
                      setProductDetailId(item.id);
                      setProductDetailOpen(true);
                    }}
                  />
                ))}
              </WriterPageStack>
            </WriterPageStack>
          </WriterPageGridHalf>
        </WriterPageGrid>

        <AlertDialog
          open={Boolean(overwritePending)}
          onOpenChange={(open) => {
            if (!open) setOverwritePending(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Replace existing file?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{overwritePending?.label}</strong> already exists. Replacing will overwrite the current file on
                disk. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="writer-pill-ghost--destructive"
                disabled={busy}
                onClick={() => overwritePending && void runUpload(overwritePending, true)}
              >
                Replace
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={Boolean(deleteProductId)}
          onOpenChange={(open) => {
            if (!open) setDeleteProductId(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete product?</AlertDialogTitle>
              <AlertDialogDescription>
                Delete product <strong>{deleteProductId}</strong> and all of its files (background, glossary, writing
                guide)? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="writer-pill-ghost--destructive"
                disabled={busy}
                onClick={() => void confirmDeleteProduct()}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <WriterModal
          open={productDetailOpen}
          onOpenChange={(open) => {
            setProductDetailOpen(open);
            if (!open) {
              window.setTimeout(() => setProductDetailId(null), WRITER_MODAL_MOTION_DURATION_MS);
            }
          }}
          title={activeProduct ? formatProductDisplayName(activeProduct.id) : ""}
          footer={
            activeProduct ? (
              <Button
                type="button"
                variant="ghost"
                className="writer-pill-ghost writer-pill-ghost--destructive"
                disabled={busy || !connected}
                onClick={() => {
                  setProductDetailOpen(false);
                  window.setTimeout(() => setProductDetailId(null), WRITER_MODAL_MOTION_DURATION_MS);
                  setDeleteProductId(activeProduct.id);
                }}
              >
                <Trash2 className="size-4" />
                Delete product
              </Button>
            ) : null
          }
        >
          {activeProduct ? (
            <div className="mt-2">
            <WriterPageStack gap={4}>
              {activeProduct.parseStatus === "error" && activeProduct.parseError ? (
                <InlineAlert
                  kind="error"
                  title="Parse error"
                  subtitle={`${activeProduct.parseError.file}${activeProduct.parseError.line ? `:${activeProduct.parseError.line}` : ""} — ${activeProduct.parseError.message}`}
                />
              ) : null}

              <UploadSlotSection
                title="Product background"
                filled={activeProduct.hasBackground}
                uploadedFileName={productSlotFilename(
                  activeProduct.hasBackground,
                  activeProduct.backgroundFilename,
                  "background.md"
                )}
                dropLabel="Drop background.md here"
                dropHint="or click to browse · paste markdown"
                accept=".md,text/markdown"
                onFiles={async (files) => {
                  const file = files[0];
                  if (!file) return;
                  const content = await readFileAsText(file);
                  queueUpload(`${activeProduct.id} product background`, activeProduct.hasBackground, async (overwrite) => {
                    await client.uploadProductBackground(activeProduct.id, {
                      content,
                      overwrite,
                      sourceFilename: file.name
                    });
                  });
                }}
                onRemove={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await client.deleteProductBackground(activeProduct.id);
                    await load();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setBusy(false);
                  }
                }}
                busy={busy}
                connected={connected}
              />

              <UploadSlotSection
                title="Glossary"
                filled={activeProduct.hasGlossary}
                uploadedFileName={productSlotFilename(
                  activeProduct.hasGlossary,
                  activeProduct.glossaryFilename,
                  "glossary.md"
                )}
                dropLabel="Drop glossary here"
                dropHint="or click to browse · .csv or .md"
                accept=".md,.csv,text/markdown,text/csv"
                onFiles={async (files) => {
                  const file = files[0];
                  if (!file) return;
                  const content = await readFileAsText(file);
                  const format = glossaryFormatFromFilename(file.name) ?? "md";
                  queueUpload(`${activeProduct.id} glossary`, activeProduct.hasGlossary, async (overwrite) => {
                    await client.uploadProductGlossary(activeProduct.id, {
                      content,
                      format,
                      overwrite,
                      sourceFilename: file.name
                    });
                  });
                }}
                onRemove={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await client.deleteProductGlossary(activeProduct.id);
                    await load();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setBusy(false);
                  }
                }}
                busy={busy}
                connected={connected}
              />

              <UploadSlotSection
                title="Writing guide"
                filled={activeProduct.hasWritingGuide}
                uploadedFileName={productSlotFilename(
                  activeProduct.hasWritingGuide,
                  activeProduct.writingGuideFilename,
                  "writing-guide.md"
                )}
                dropLabel="Drop writing-guide.md here"
                dropHint="or click to browse · paste markdown"
                accept=".md,text/markdown"
                onFiles={async (files) => {
                  const file = files[0];
                  if (!file) return;
                  const content = await readFileAsText(file);
                  queueUpload(`${activeProduct.id} writing guide`, activeProduct.hasWritingGuide, async (overwrite) => {
                    await client.uploadProductWritingGuide(activeProduct.id, {
                      content,
                      overwrite,
                      sourceFilename: file.name
                    });
                  });
                }}
                onRemove={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await client.deleteProductWritingGuide(activeProduct.id);
                    await load();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setBusy(false);
                  }
                }}
                busy={busy}
                connected={connected}
              />
            </WriterPageStack>
            </div>
          ) : null}
        </WriterModal>

        <WriterModal
          open={addProductOpen}
          onOpenChange={(open) => {
            setAddProductOpen(open);
            if (!open) {
              setNewProductSlots(EMPTY_NEW_PRODUCT_FILE_SLOTS);
              setNewProductId("");
            }
          }}
          title="Add product"
          footer={
            <WriterPrimaryButton
              disabled={busy || !newProductId.trim() || collectNewProductFiles(newProductSlots).length === 0}
              onClick={() => void submitAddProduct()}
            >
              {busy ? "Creating…" : "Create"}
            </WriterPrimaryButton>
          }
        >
          <div className="mt-2">
            <WriterPageStack gap={4}>
              <ProductIdFieldSection
                value={newProductId}
                disabled={busy}
                onChange={setNewProductId}
              />

              <div className="writer-modal-product-file-slots">
                <WriterPageStack gap={4}>
                  <UploadSlotSection
                    title="Product background"
                    filled={Boolean(newProductSlots.background)}
                    uploadedFileName={productSlotFilename(
                      Boolean(newProductSlots.background),
                      newProductSlots.background?.filename,
                      "background.md"
                    )}
                    accept=".md,text/markdown"
                    showDropZone={false}
                    onFiles={(files) => void stageNewProductSlot("background", files)}
                    onRemove={() => setNewProductSlots((prev) => ({ ...prev, background: undefined }))}
                    busy={busy}
                    connected
                  />

                  <WriterHomeDivider />

                  <UploadSlotSection
                    title="Glossary"
                    filled={Boolean(newProductSlots.glossary)}
                    uploadedFileName={productSlotFilename(
                      Boolean(newProductSlots.glossary),
                      newProductSlots.glossary?.filename,
                      "glossary.md"
                    )}
                    accept=".md,.csv,text/markdown,text/csv"
                    showDropZone={false}
                    onFiles={(files) => void stageNewProductSlot("glossary", files)}
                    onRemove={() => setNewProductSlots((prev) => ({ ...prev, glossary: undefined }))}
                    busy={busy}
                    connected
                  />

                  <WriterHomeDivider />

                  <UploadSlotSection
                    title="Writing guide"
                    filled={Boolean(newProductSlots.writingGuide)}
                    uploadedFileName={productSlotFilename(
                      Boolean(newProductSlots.writingGuide),
                      newProductSlots.writingGuide?.filename,
                      "writing-guide.md"
                    )}
                    accept=".md,text/markdown"
                    showDropZone={false}
                    onFiles={(files) => void stageNewProductSlot("writingGuide", files)}
                    onRemove={() => setNewProductSlots((prev) => ({ ...prev, writingGuide: undefined }))}
                    busy={busy}
                    connected
                  />
                </WriterPageStack>
              </div>
            </WriterPageStack>
          </div>
        </WriterModal>
    </WriterPageStack>
  );
}

function ProductIdFieldSection({
  value,
  onChange,
  disabled
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <WriterSectionHeader title="Product name" />
      <GlassCard variant="outline" className="flex min-h-[61px] items-center px-4 py-2.5">
        <Input
          id="new-product-id"
          value={value}
          disabled={disabled}
          placeholder="What's the product name?"
          className="writer-modal-id-field flex-1"
          onChange={(e) => onChange(e.target.value.replace(/[^a-zA-Z0-9-_]/g, "-"))}
        />
      </GlassCard>
    </section>
  );
}

function UploadSlotSection({
  title,
  description,
  filled,
  uploadedFileName,
  dropLabel,
  dropHint,
  accept,
  multiple,
  showDropZone = true,
  onFiles,
  onRemove,
  busy,
  connected
}: {
  title: string;
  description?: string;
  filled: boolean;
  /** Basename shown when filled (e.g. ddpm.md, glossary.csv). */
  uploadedFileName?: string;
  dropLabel?: string;
  dropHint?: string;
  accept: string;
  multiple?: boolean;
  /** When false, only + Add opens the file picker (no dashed drop area). */
  showDropZone?: boolean;
  onFiles: (files: File[]) => void;
  onRemove: () => void | Promise<void>;
  busy: boolean;
  connected: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadDisabled = busy || !connected;
  const addDisabled = uploadDisabled || filled;
  const fileLabel = uploadedFileName?.trim();

  return (
    <section className="flex flex-col gap-3">
      <WriterSectionHeader
        title={title}
        description={description}
        actions={
          <Button
            type="button"
            variant="ghost"
            className="writer-pill-ghost writer-pill-add"
            disabled={addDisabled}
            aria-label={`Add ${title}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
            <span>Add</span>
          </Button>
        }
      />
      <WriterPageStack gap={4}>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length) {
              onFiles(files);
            }
            event.target.value = "";
          }}
        />
        {filled && fileLabel ? (
          <GuidelineFileRow
            title={fileLabel}
            removeDisabled={uploadDisabled}
            removeLabel={`Remove ${title}`}
            onRemove={() => void onRemove()}
          />
        ) : filled ? null : showDropZone && dropLabel && dropHint ? (
          <DropZone
            label={dropLabel}
            hint={dropHint}
            accept={accept}
            multiple={multiple}
            onFiles={onFiles}
            disabled={uploadDisabled}
            fileInputRef={fileInputRef}
          />
        ) : null}
      </WriterPageStack>
    </section>
  );
}
