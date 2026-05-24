import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

import type { Guideline, GuidelinesTree, ProductPackageListItem } from "@writer/contracts";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
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
import { Textarea } from "@/components/ui/textarea";
import { InlineAlert } from "@/components/writer/inline-alert";
import { StatusBadge } from "@/components/writer/status-badge";
import { cn } from "@/lib/utils";

import { DaemonClientError } from "../daemon-client";
import { WriterPageGrid, WriterPageGridFull, WriterPageStack } from "../layout/writer-grid";
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
  disabled
}: {
  label: string;
  hint: string;
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
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
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        "rounded-lg border-2 border-dashed p-6 text-center transition-colors",
        over ? "border-primary bg-accent/40" : "border-border bg-card",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      )}
    >
      <div className="mb-1 font-semibold">{label}</div>
      <div className="text-sm text-muted-foreground">{hint}</div>
      <input
        ref={inputRef}
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

function inferProductSlot(filename: string): "background" | "glossary" | "writing-guide" | "extra" {
  const name = filename.toLowerCase();
  if (name.endsWith(".csv")) return "glossary";
  if (name === "background.md" || name.endsWith("/background.md")) return "background";
  if (name.includes("glossary")) return "glossary";
  if (name.includes("writing") && name.endsWith(".md")) return "writing-guide";
  if (name.endsWith(".md")) return "background";
  return "extra";
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
  const [viewProductId, setViewProductId] = useState<string | null>(null);
  const [viewBackgroundBody, setViewBackgroundBody] = useState<string | null>(null);

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

  const handleProductFiles = useCallback(
    (productId: string, item: ProductPackageListItem) =>
      async (files: File[]) => {
        for (const file of files) {
          const content = await readFileAsText(file);
          const slot = inferProductSlot(file.name);
          const format = glossaryFormatFromFilename(file.name) ?? "md";

          if (slot === "glossary") {
            queueUpload(`${productId} glossary`, item.hasGlossary, async (overwrite) => {
              await client.uploadProductGlossary(productId, { content, format, overwrite });
            });
            continue;
          }
          if (slot === "background") {
            queueUpload(`${productId} background`, item.hasBackground, async (overwrite) => {
              await client.uploadProductBackground(productId, { content, overwrite });
            });
            continue;
          }
          if (slot === "writing-guide") {
            queueUpload(`${productId} writing guide`, item.hasWritingGuide, async (overwrite) => {
              await client.uploadProductWritingGuide(productId, { content, overwrite });
            });
            continue;
          }
          queueUpload(`${productId} file ${file.name}`, true, async (overwrite) => {
            await client.uploadProductFile(productId, { filename: file.name, content, overwrite });
          });
        }
      },
    [client, queueUpload]
  );

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

  const openProductBackground = useCallback(
    async (productId: string) => {
      setBusy(true);
      setError(null);
      try {
        const pkg = await client.getProduct(productId);
        const body = pkg.background?.content ?? pkg.background?.body ?? "";
        setViewBackgroundBody(body);
        setViewProductId(productId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [client]
  );

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

  return (
    <WriterPageGrid gutterMode="narrow" className="h-full">
      <WriterPageGridFull>
        <WriterPageStack gap={6}>
          {error ? (
            <InlineAlert kind="error" title="Error" subtitle={error} onClose={() => setError(null)} />
          ) : null}
          {info ? (
            <InlineAlert kind="success" title="Success" subtitle={info} onClose={() => setInfo(null)} />
          ) : null}
          {tree?.conflictError ? (
            <InlineAlert kind="error" title="Guideline conflict" subtitle={tree.conflictError} />
          ) : null}

          <CompanySlotSection
            title="Company base"
            templateHref={client.companyBaseTemplateUrl()}
            templateName="company-base-template.md"
            guideline={tree?.companyBase ?? null}
            missing={tree?.companyBaseMissing ?? false}
            missingHint="Upload company-base.md to ground reviews in company-wide rules."
            dropLabel="Drop company-base.md here"
            dropHint="or click to browse · paste markdown"
            accept=".md,text/markdown"
            onFiles={handleCompanyBaseFiles}
            onBrowse={async () => {
              const picked = await browseMarkdown();
              if (picked) void handleCompanyBaseFiles([new File([picked.content], picked.filename, { type: "text/markdown" })]);
            }}
            busy={busy}
            connected={connected}
          />

          <CompanySlotSection
            title="Software writing"
            templateHref={client.softwareWritingTemplateUrl()}
            templateName="software-writing-template.md"
            guideline={tree?.softwareWriting ?? null}
            missing={tree?.softwareWritingMissing ?? false}
            missingHint="Upload software-writing.md for cross-product writing standards."
            dropLabel="Drop software-writing.md here"
            dropHint="or click to browse · paste markdown"
            accept=".md,text/markdown"
            onFiles={handleSoftwareWritingFiles}
            onBrowse={async () => {
              const picked = await browseMarkdown();
              if (picked) void handleSoftwareWritingFiles([new File([picked.content], picked.filename, { type: "text/markdown" })]);
            }}
            busy={busy}
            connected={connected}
          />

          <section>
            <WriterSectionHeader
              title="Products"
              actions={
                <Button size="sm" disabled={busy || !connected} onClick={() => setAddProductOpen(true)}>
                  Add product
                </Button>
              }
            />

            {tree && tree.products.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">
                    No products yet. Add a product with a required background.md.
                  </p>
                </CardContent>
              </Card>
            ) : null}

            <Accordion>
              {tree?.products.map((item) => (
                <AccordionItem key={item.id} value={item.id}>
                  <AccordionTrigger>
                    <span className="flex flex-wrap items-center gap-3">
                      <strong>{item.name}</strong>
                      <span className="text-xs text-muted-foreground">{item.id}</span>
                      <StatusBadge
                        status={
                          item.parseStatus === "ok"
                            ? "ok"
                            : item.parseStatus === "error"
                              ? "error"
                              : "incomplete"
                        }
                      />
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const files = Array.from(e.dataTransfer.files);
                        if (files.length) void handleProductFiles(item.id, item)(files);
                      }}
                      className="mb-4"
                    >
                      <DropZone
                        label={`Drop files on ${item.id}`}
                        hint="glossary · background · writing guide · other notes — any format you use"
                        accept=".md,.csv,.txt,text/*"
                        multiple
                        onFiles={(files) => void handleProductFiles(item.id, item)(files)}
                        disabled={busy || !connected}
                      />
                    </div>

                    {item.parseStatus === "error" && item.parseError ? (
                      <InlineAlert
                        kind="error"
                        title="Parse error"
                        subtitle={`${item.parseError.file}${item.parseError.line ? `:${item.parseError.line}` : ""} — ${item.parseError.message}`}
                      />
                    ) : null}

                    <ProductSlotRow
                      label="Glossary"
                      filled={item.hasGlossary}
                      busy={busy}
                      connected={connected}
                      canDelete
                      onReplace={async () => {
                        const picked = await browseGlossary();
                        if (!picked) return;
                        queueUpload(`${item.id} glossary`, item.hasGlossary, async (overwrite) => {
                          await client.uploadProductGlossary(item.id, {
                            content: picked.content,
                            format: picked.format,
                            overwrite
                          });
                        });
                      }}
                      onDelete={() => {
                        if (!window.confirm(`Delete glossary for ${item.id}?`)) return;
                        setBusy(true);
                        void client
                          .deleteProductGlossary(item.id)
                          .then(() => load())
                          .catch((err) => setError(err instanceof Error ? err.message : String(err)))
                          .finally(() => setBusy(false));
                      }}
                    />

                    <ProductSlotRow
                      label="Background"
                      filled={item.hasBackground}
                      busy={busy}
                      connected={connected}
                      canDelete={false}
                      onOpen={() => void openProductBackground(item.id)}
                      onReplace={async () => {
                        const picked = await browseMarkdown();
                        if (!picked) return;
                        queueUpload(`${item.id} background`, item.hasBackground, async (overwrite) => {
                          await client.uploadProductBackground(item.id, { content: picked.content, overwrite });
                        });
                      }}
                    />

                    <ProductSlotRow
                      label="Writing guide"
                      filled={item.hasWritingGuide}
                      busy={busy}
                      connected={connected}
                      canDelete
                      onReplace={async () => {
                        const picked = await browseMarkdown();
                        if (!picked) return;
                        queueUpload(`${item.id} writing guide`, item.hasWritingGuide, async (overwrite) => {
                          await client.uploadProductWritingGuide(item.id, { content: picked.content, overwrite });
                        });
                      }}
                      onDelete={() => {
                        if (!window.confirm(`Delete writing guide for ${item.id}?`)) return;
                        setBusy(true);
                        void client
                          .deleteProductWritingGuide(item.id)
                          .then(() => load())
                          .catch((err) => setError(err instanceof Error ? err.message : String(err)))
                          .finally(() => setBusy(false));
                      }}
                    />

                    {item.extraFileCount > 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {item.extraFileCount} additional file{item.extraFileCount === 1 ? "" : "s"} in this product
                        folder (included in audits as raw text).
                      </p>
                    ) : null}

                    <div className="mt-4 flex justify-end">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={busy || !connected}
                        onClick={() => setDeleteProductId(item.id)}
                      >
                        <Trash2 className="size-4" />
                        Delete product
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        </WriterPageStack>

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

        <Dialog
          open={Boolean(viewProductId)}
          onOpenChange={(open) => {
            if (!open) {
              setViewProductId(null);
              setViewBackgroundBody(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Background — {viewProductId}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="view-background-body">Body</Label>
              <Textarea id="view-background-body" value={viewBackgroundBody ?? ""} readOnly rows={16} />
            </div>
          </DialogContent>
        </Dialog>

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
              <Button
                disabled={busy || !newProductId.trim() || newProductFiles.length === 0}
                onClick={() => void submitAddProduct()}
              >
                {busy ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </WriterPageGridFull>
    </WriterPageGrid>
  );
}

function CompanySlotSection({
  title,
  templateHref,
  templateName,
  guideline,
  missing,
  missingHint,
  dropLabel,
  dropHint,
  accept,
  onFiles,
  onBrowse,
  busy,
  connected
}: {
  title: string;
  templateHref: string;
  templateName: string;
  guideline: Guideline | null;
  missing: boolean;
  missingHint: string;
  dropLabel: string;
  dropHint: string;
  accept: string;
  onFiles: (files: File[]) => void;
  onBrowse: () => void;
  busy: boolean;
  connected: boolean;
}) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline gap-4">
        <WriterSectionHeader title={title} />
        <a href={templateHref} download={templateName} className="text-sm underline-offset-4 hover:underline">
          Download template
        </a>
      </div>
      <WriterPageStack gap={4}>
        {missing ? <InlineAlert kind="warning" title="Missing" subtitle={missingHint} /> : null}
        <DropZone label={dropLabel} hint={dropHint} accept={accept} onFiles={onFiles} disabled={busy || !connected} />
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => void onBrowse()} disabled={busy || !connected}>
            Browse…
          </Button>
        </div>
        {guideline ? (
          <GuidelineTile guideline={guideline} />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Not uploaded yet.</p>
            </CardContent>
          </Card>
        )}
      </WriterPageStack>
    </section>
  );
}

function GuidelineTile({ guideline }: { guideline: Guideline }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <strong>{guideline.id}</strong>
          <span className="text-xs text-muted-foreground">{guideline.layer}</span>
          <StatusBadge status="ok" />
          <span className="ml-auto text-xs text-muted-foreground">v{guideline.version}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          {guideline.rules.length} rules · {guideline.glossary.length} terms
        </div>
      </CardContent>
    </Card>
  );
}

function ProductSlotRow({
  label,
  filled,
  busy,
  connected,
  canDelete,
  onOpen,
  onReplace,
  onDelete
}: {
  label: string;
  filled: boolean;
  busy: boolean;
  connected: boolean;
  canDelete: boolean;
  onOpen?: () => void;
  onReplace: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b py-3">
      <span className="min-w-28 font-semibold">{label}</span>
      <StatusBadge status={filled ? "ok" : "incomplete"} />
      <span className="text-sm text-muted-foreground">{filled ? "Uploaded" : "Empty"}</span>
      <span className="ml-auto flex gap-1">
        {filled && onOpen ? (
          <Button variant="ghost" size="sm" disabled={busy || !connected} onClick={onOpen}>
            Open
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" disabled={busy || !connected} onClick={() => void onReplace()}>
          {filled ? "Replace" : "Upload"}
        </Button>
        {filled && canDelete && onDelete ? (
          <Button variant="destructive" size="sm" disabled={busy || !connected} onClick={onDelete}>
            Delete
          </Button>
        ) : null}
      </span>
    </div>
  );
}
