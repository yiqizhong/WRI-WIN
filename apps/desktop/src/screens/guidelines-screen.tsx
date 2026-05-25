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
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GuidelineDetailDialog } from "@/components/writer/guideline-detail-dialog";
import { GuidelineFileRow, GuidelineRowCard } from "@/components/writer/guideline-row-card";
import { InlineAlert } from "@/components/writer/inline-alert";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";
import { cn } from "@/lib/utils";

import { DaemonClientError } from "../daemon-client";
import { WriterPageGrid, WriterPageGridHalf, WriterPageStack } from "../layout/writer-grid";
import { WriterSectionHeader } from "../layout/writer-headings";
import { useWorkspace } from "../workspace-context";

type PendingUpload = {
  label: string;
  exists: boolean;
  run: (overwrite: boolean) => Promise<void>;
};

type StagedFile = { filename: string; content: string };

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
  const [info, setInfo] = useState<string | null>(null);

  const [overwritePending, setOverwritePending] = useState<PendingUpload | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [productDetailId, setProductDetailId] = useState<string | null>(null);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [newProductId, setNewProductId] = useState("");
  const [newProductFiles, setNewProductFiles] = useState<StagedFile[]>([]);

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
      setInfo(null);
      try {
        await pending.run(overwrite);
        setOverwritePending(null);
        setInfo(`Updated: ${pending.label}`);
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
        await client.uploadCompanyBase({ content, overwrite });
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
        await client.uploadSoftwareWriting({ content, overwrite });
      });
    },
    [client, queueUpload, tree?.softwareWriting]
  );

  const handleRemoveCompanyBase = useCallback(async () => {
    if (!window.confirm("Remove company base guidelines?")) {
      return;
    }
    setBusy(true);
    try {
      await client.deleteCompanyBase();
      setInfo("Removed company base.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [client, load]);

  const handleRemoveSoftwareWriting = useCallback(async () => {
    if (!window.confirm("Remove software writing guidelines?")) {
      return;
    }
    setBusy(true);
    try {
      await client.deleteSoftwareWriting();
      setInfo("Removed software writing.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [client, load]);

  const stageNewProductFiles = useCallback(async (files: File[]) => {
    const staged: StagedFile[] = [];
    for (const file of files) {
      staged.push({ filename: file.name, content: await readFileAsText(file) });
    }
    setNewProductFiles((prev) => [...prev, ...staged]);
  }, []);

  const browseMarkdown = useCallback(async (): Promise<{ filename: string; content: string } | null> => {
    return (await window.writerDesktop?.pickGuidelineFile()) ?? null;
  }, []);

  const browseGlossary = useCallback(async (): Promise<{ filename: string; content: string; format: "csv" | "md" } | null> => {
    return (await window.writerDesktop?.pickGlossaryFile()) ?? null;
  }, []);

  const submitAddProduct = useCallback(async () => {
    const id = newProductId.trim().replace(/[^a-zA-Z0-9-_]/g, "-");
    if (!id) {
      setError("Product id is required.");
      return;
    }
    if (newProductFiles.length === 0) {
      setError("Drop at least one file (background, glossary, writing guide, or notes).");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await client.createProduct({ id, files: newProductFiles });
      setAddProductOpen(false);
      setNewProductId("");
      setNewProductFiles([]);
      setInfo(`Created product: ${id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [client, load, newProductFiles, newProductId]);

  const confirmDeleteProduct = useCallback(async () => {
    if (!deleteProductId) return;
    setBusy(true);
    try {
      await client.deleteProduct(deleteProductId);
      setDeleteProductId(null);
      setInfo(`Deleted product: ${deleteProductId}`);
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
      {info ? (
        <InlineAlert kind="success" title="Success" subtitle={info} onClose={() => setInfo(null)} />
      ) : null}
      {tree?.conflictError ? (
        <InlineAlert kind="error" title="Guideline conflict" subtitle={tree.conflictError} />
      ) : null}

      <WriterPageGrid className="w-full grid-cols-1 auto-rows-min gap-10 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-x-14 lg:gap-y-8">
        <WriterPageGridHalf>
            <WriterPageStack gap={9}>
              <UploadSlotSection
                title="Company base"
                description="Global guidelines applied to every product review."
                filled={Boolean(tree?.companyBase)}
                tileTitle={tree?.companyBase?.id ?? "company-base"}
                tileSummary={
                  tree?.companyBase
                    ? `${tree.companyBase.rules.length} rules · ${tree.companyBase.glossary.length} terms`
                    : ""
                }
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
                tileTitle={tree?.softwareWriting?.id ?? "software-writing"}
                tileSummary={
                  tree?.softwareWriting
                    ? `${tree.softwareWriting.rules.length} rules · ${tree.softwareWriting.glossary.length} terms`
                    : ""
                }
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
                description="Dedicated background, glossary, and guides for individual products."
                actions={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-[#e5f1ff]/75 hover:bg-[rgb(32_131_234/0.14)] hover:text-[#e5f1ff]"
                    disabled={busy || !connected}
                    aria-label="Add product"
                    onClick={() => setAddProductOpen(true)}
                  >
                    <Plus className="size-4" strokeWidth={1.5} aria-hidden />
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
                    title={item.name}
                    subtitle={item.id}
                    onOpen={() => setProductDetailId(item.id)}
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
                variant="destructive"
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
                variant="destructive"
                disabled={busy}
                onClick={() => void confirmDeleteProduct()}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <GuidelineDetailDialog
          open={Boolean(activeProduct)}
          onOpenChange={(open) => {
            if (!open) {
              setProductDetailId(null);
            }
          }}
          title={activeProduct?.name ?? "Product"}
          description={activeProduct?.id}
          contentClassName="sm:max-w-2xl"
          footer={
            activeProduct ? (
              <Button
                variant="destructive"
                size="sm"
                disabled={busy || !connected}
                onClick={() => {
                  setProductDetailId(null);
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
                title="Background"
                description="Product context used in audits for this product."
                filled={activeProduct.hasBackground}
                tileTitle={activeProduct.id}
                tileSummary="background.md"
                dropLabel="Drop background.md here"
                dropHint="or click to browse · paste markdown"
                accept=".md,text/markdown"
                onFiles={async (files) => {
                  const file = files[0];
                  if (!file) return;
                  const content = await readFileAsText(file);
                  queueUpload(`${activeProduct.id} background`, activeProduct.hasBackground, async (overwrite) => {
                    await client.uploadProductBackground(activeProduct.id, { content, overwrite });
                  });
                }}
                onRemove={async () => {
                  if (!window.confirm(`Remove background for ${activeProduct.id}?`)) return;
                  setBusy(true);
                  try {
                    await client.deleteProductBackground(activeProduct.id);
                    setInfo(`Removed background for ${activeProduct.id}.`);
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
                description="Terms and definitions for this product."
                filled={activeProduct.hasGlossary}
                tileTitle={`${activeProduct.id} · glossary`}
                tileSummary="glossary.csv or glossary.md"
                dropLabel="Drop glossary here"
                dropHint="or click to browse · .csv or .md"
                accept=".md,.csv,text/markdown,text/csv"
                onFiles={async (files) => {
                  const file = files[0];
                  if (!file) return;
                  const content = await readFileAsText(file);
                  const format = glossaryFormatFromFilename(file.name) ?? "md";
                  queueUpload(`${activeProduct.id} glossary`, activeProduct.hasGlossary, async (overwrite) => {
                    await client.uploadProductGlossary(activeProduct.id, { content, format, overwrite });
                  });
                }}
                onRemove={async () => {
                  if (!window.confirm(`Remove glossary for ${activeProduct.id}?`)) return;
                  setBusy(true);
                  try {
                    await client.deleteProductGlossary(activeProduct.id);
                    setInfo(`Removed glossary for ${activeProduct.id}.`);
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
                description="Product-specific writing rules."
                filled={activeProduct.hasWritingGuide}
                tileTitle={`${activeProduct.id} · writing guide`}
                tileSummary="writing-guide.md"
                dropLabel="Drop writing-guide.md here"
                dropHint="or click to browse · paste markdown"
                accept=".md,text/markdown"
                onFiles={async (files) => {
                  const file = files[0];
                  if (!file) return;
                  const content = await readFileAsText(file);
                  queueUpload(`${activeProduct.id} writing guide`, activeProduct.hasWritingGuide, async (overwrite) => {
                    await client.uploadProductWritingGuide(activeProduct.id, { content, overwrite });
                  });
                }}
                onRemove={async () => {
                  if (!window.confirm(`Remove writing guide for ${activeProduct.id}?`)) return;
                  setBusy(true);
                  try {
                    await client.deleteProductWritingGuide(activeProduct.id);
                    setInfo(`Removed writing guide for ${activeProduct.id}.`);
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

              {activeProduct.extraFileCount > 0 ? (
                <p className="text-sm text-[#e5f1ff]/60">
                  {activeProduct.extraFileCount} additional file
                  {activeProduct.extraFileCount === 1 ? "" : "s"} in this product folder (included in audits as raw
                  text).
                </p>
              ) : null}
            </WriterPageStack>
            </div>
          ) : null}
        </GuidelineDetailDialog>

        <Dialog
          open={addProductOpen}
          onOpenChange={(open) => {
            setAddProductOpen(open);
            if (!open) setNewProductFiles([]);
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add product</DialogTitle>
            </DialogHeader>
            <WriterPageStack gap={4}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-product-id">Product id</Label>
                <Input
                  id="new-product-id"
                  value={newProductId}
                  onChange={(e) => setNewProductId(e.target.value.replace(/[^a-zA-Z0-9-_]/g, "-"))}
                />
                <p className="text-sm text-muted-foreground">
                  Folder name under products/ (letters, numbers, - and _)
                </p>
              </div>
              <DropZone
                label="Drop product files here"
                hint="background · glossary · writing guide · any notes (.md, .csv, .txt) — no required format"
                accept=".md,.csv,.txt,text/*"
                multiple
                onFiles={(files) => void stageNewProductFiles(files)}
                disabled={busy}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const picked = await browseMarkdown();
                    if (picked) void stageNewProductFiles([new File([picked.content], picked.filename)]);
                  }}
                >
                  Add .md…
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const picked = await browseGlossary();
                    if (picked) void stageNewProductFiles([new File([picked.content], picked.filename)]);
                  }}
                >
                  Add glossary…
                </Button>
              </div>
              {newProductFiles.length > 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="mb-2 font-semibold">{newProductFiles.length} file(s) ready</p>
                    <ul className="list-inside list-disc text-sm">
                      {newProductFiles.map((f) => (
                        <li key={f.filename}>
                          <code>{f.filename}</code>
                        </li>
                      ))}
                    </ul>
                    <Button variant="ghost" size="sm" className="mt-3" onClick={() => setNewProductFiles([])}>
                      Clear files
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
            </WriterPageStack>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setAddProductOpen(false);
                  setNewProductFiles([]);
                }}
              >
                Cancel
              </Button>
              <WriterPrimaryButton
                className="h-8 px-4 py-0 text-sm"
                disabled={busy || !newProductId.trim() || newProductFiles.length === 0}
                onClick={() => void submitAddProduct()}
              >
                {busy ? "Creating…" : "Create"}
              </WriterPrimaryButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </WriterPageStack>
  );
}

function UploadSlotSection({
  title,
  description,
  filled,
  tileTitle,
  tileSummary,
  dropLabel,
  dropHint,
  accept,
  multiple,
  onFiles,
  onRemove,
  busy,
  connected
}: {
  title: string;
  description: string;
  filled: boolean;
  tileTitle: string;
  tileSummary: string;
  dropLabel: string;
  dropHint: string;
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  onRemove: () => void | Promise<void>;
  busy: boolean;
  connected: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadDisabled = busy || !connected;

  return (
    <section className="flex flex-col gap-3">
      <WriterSectionHeader
        title={title}
        description={description}
        actions={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-[#e5f1ff]/75 hover:bg-[rgb(32_131_234/0.14)] hover:text-[#e5f1ff]"
            disabled={uploadDisabled}
            aria-label={`Add ${title}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="size-4" strokeWidth={1.5} aria-hidden />
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
        {filled ? (
          <GuidelineFileRow
            title={tileTitle}
            subtitle={tileSummary}
            removeDisabled={uploadDisabled}
            removeLabel={`Remove ${title}`}
            onRemove={() => void onRemove()}
          />
        ) : (
          <DropZone
            label={dropLabel}
            hint={dropHint}
            accept={accept}
            multiple={multiple}
            onFiles={onFiles}
            disabled={uploadDisabled}
            fileInputRef={fileInputRef}
          />
        )}
      </WriterPageStack>
    </section>
  );
}
