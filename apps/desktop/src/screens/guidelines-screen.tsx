import { useCallback, useEffect, useRef, useState } from "react";

import {
  Accordion,
  AccordionItem,
  Button,
  InlineNotification,
  Modal,
  TextArea,
  TextInput,
  Tile
} from "@carbon/react";
import { TrashCan } from "@carbon/icons-react";

import type { Guideline, GuidelinesTree, ProductPackageListItem } from "@writer/contracts";

import { DaemonClientError } from "../daemon-client";
import { WriterPageGrid, WriterPageGridFull, WriterPageStack } from "../layout/writer-grid";
import { WriterSectionHeader } from "../layout/writer-headings";
import { useWorkspace } from "../workspace-context";

type PendingUpload = {
  label: string;
  exists: boolean;
  run: (overwrite: boolean) => Promise<void>;
};

type AddProductMode = "form" | "file";

function StatusPill({ status }: { status: "ok" | "error" | "incomplete" }) {
  const label = status === "ok" ? "OK" : status === "error" ? "ERROR" : "INCOMPLETE";
  const bg =
    status === "ok"
      ? "var(--cds-support-success)"
      : status === "error"
        ? "var(--cds-support-error)"
        : "var(--cds-support-warning)";
  return (
    <span
      style={{
        padding: "0 0.5rem",
        borderRadius: "0.25rem",
        fontSize: "0.75rem",
        fontWeight: 600,
        background: bg,
        color: "#fff"
      }}
    >
      {label}
    </span>
  );
}

function DropZone({
  label,
  hint,
  accept,
  onFiles,
  disabled
}: {
  label: string;
  hint: string;
  accept: string;
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
      style={{
        border: `2px dashed ${over ? "var(--cds-interactive)" : "var(--cds-border-subtle)"}`,
        background: over ? "var(--cds-layer-accent-01)" : "var(--cds-layer-01)",
        padding: "1.5rem",
        borderRadius: "0.5rem",
        textAlign: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s"
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{label}</div>
      <div style={{ fontSize: "0.875rem", color: "var(--cds-text-helper)" }}>{hint}</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
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

function looksLikeBackgroundMarkdown(content: string): boolean {
  return /^---\s*\n[\s\S]*?\b(audience|environment|purpose)\b[\s\S]*?---/m.test(content);
}

function inferProductSlot(filename: string, content: string): "background" | "glossary" | "writing-guide" {
  const name = filename.toLowerCase();
  if (name.endsWith(".csv")) return "glossary";
  if (name === "background.md" || name.endsWith("/background.md")) return "background";
  if (name.includes("glossary")) return "glossary";
  if (name.endsWith(".md")) {
    if (looksLikeBackgroundMarkdown(content)) return "background";
    if (name.includes("writing")) return "writing-guide";
    return "writing-guide";
  }
  return "background";
}

function buildBackgroundMarkdown(input: {
  id: string;
  name: string;
  audience: string;
  environment: string;
  purpose: string;
  body: string;
}): string {
  const now = new Date().toISOString();
  return `---
id: ${input.id}
name: ${JSON.stringify(input.name)}
audience: ${JSON.stringify(input.audience)}
environment: ${JSON.stringify(input.environment)}
purpose: ${JSON.stringify(input.purpose)}
schema: 1
version: "1.0.0"
updatedAt: ${JSON.stringify(now)}
---

${input.body.trim()}
`;
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
  const [addMode, setAddMode] = useState<AddProductMode>("form");
  const [newProductId, setNewProductId] = useState("");
  const [newAudience, setNewAudience] = useState("");
  const [newEnvironment, setNewEnvironment] = useState("");
  const [newPurpose, setNewPurpose] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newBackgroundFile, setNewBackgroundFile] = useState<{ filename: string; content: string } | null>(null);

  const load = useCallback(async () => {
    if (!connected) return;
    setError(null);
    try {
      const t = await client.getGuidelinesTree();
      setTree(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
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
      if (!file.name.endsWith(".md")) {
        setError(`Company base must be a .md file. Got: ${file.name}`);
        return;
      }
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
      if (!file.name.endsWith(".md")) {
        setError(`Software writing must be a .md file. Got: ${file.name}`);
        return;
      }
      const content = await readFileAsText(file);
      queueUpload("Software writing", Boolean(tree?.softwareWriting), async (overwrite) => {
        await client.uploadSoftwareWriting({ content, overwrite });
      });
    },
    [client, queueUpload, tree?.softwareWriting]
  );

  const handleCompanyGlossaryFiles = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      const format = glossaryFormatFromFilename(file.name);
      if (!format) {
        setError(`Company glossary must be .csv or .md. Got: ${file.name}`);
        return;
      }
      const content = await readFileAsText(file);
      const hasGlossary = (tree?.companyGlossary.length ?? 0) > 0;
      queueUpload("Company glossary", hasGlossary, async (overwrite) => {
        await client.uploadCompanyGlossary({ content, format, overwrite });
      });
    },
    [client, queueUpload, tree?.companyGlossary.length]
  );

  const handleProductFiles = useCallback(
    (productId: string, item: ProductPackageListItem) =>
      async (files: File[]) => {
        const file = files[0];
        if (!file) return;
        const content = await readFileAsText(file);
        const slot = inferProductSlot(file.name, content);
        const format = glossaryFormatFromFilename(file.name);

        if (slot === "glossary") {
          if (!format) {
            setError(`Glossary must be .csv or .md. Got: ${file.name}`);
            return;
          }
          queueUpload(`${productId} glossary`, item.hasGlossary, async (overwrite) => {
            await client.uploadProductGlossary(productId, { content, format, overwrite });
          });
          return;
        }

        if (slot === "background") {
          if (!file.name.endsWith(".md")) {
            setError("Product background must be markdown.");
            return;
          }
          queueUpload(`${productId} background`, item.hasBackground, async (overwrite) => {
            await client.uploadProductBackground(productId, { content, overwrite });
          });
          return;
        }

        if (!file.name.endsWith(".md")) {
          setError(`Writing guide must be a .md file. Got: ${file.name}`);
          return;
        }
        queueUpload(`${productId} writing guide`, item.hasWritingGuide, async (overwrite) => {
          await client.uploadProductWritingGuide(productId, { content, overwrite });
        });
      },
    [client, queueUpload]
  );

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
        const body = pkg.background.body ?? "";
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
    let content: string;
    if (addMode === "file") {
      if (!newBackgroundFile) {
        setError("Upload a background.md file or switch to the form.");
        return;
      }
      content = newBackgroundFile.content;
    } else {
      if (!newAudience.trim() || !newEnvironment.trim() || !newPurpose.trim()) {
        setError("Audience, environment, and purpose are required.");
        return;
      }
      content = buildBackgroundMarkdown({
        id,
        name: id,
        audience: newAudience.trim(),
        environment: newEnvironment.trim(),
        purpose: newPurpose.trim(),
        body: newBody
      });
    }

    setBusy(true);
    setError(null);
    try {
      await client.createProduct({ id, content });
      setAddProductOpen(false);
      setNewProductId("");
      setNewAudience("");
      setNewEnvironment("");
      setNewPurpose("");
      setNewBody("");
      setNewBackgroundFile(null);
      setInfo(`Created product: ${id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [
    addMode,
    client,
    load,
    newAudience,
    newBackgroundFile,
    newBody,
    newEnvironment,
    newProductId,
    newPurpose
  ]);

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
    <WriterPageGrid gutterMode="narrow">
      <WriterPageGridFull>
        <WriterPageStack gap={6}>
          {error && (
            <InlineNotification
              kind="error"
              title="Error"
              subtitle={error}
              onCloseButtonClick={() => setError(null)}
              lowContrast
            />
          )}
          {info && (
            <InlineNotification
              kind="success"
              title="Success"
              subtitle={info}
              onCloseButtonClick={() => setInfo(null)}
              lowContrast
            />
          )}
          {tree?.conflictError && (
            <InlineNotification
              kind="error"
              title="Guideline conflict"
              subtitle={tree.conflictError}
              lowContrast
            />
          )}

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
            <div style={{ display: "flex", alignItems: "baseline", gap: "1rem", marginBottom: "1rem" }}>
              <WriterSectionHeader title="Company glossary" />
              <a href={client.glossaryTemplateUrl()} download="glossary-template.csv" style={{ fontSize: "0.875rem" }}>
                Download .csv template
              </a>
            </div>
            <WriterPageStack gap={4}>
              <DropZone
                label="Drop company-glossary.csv or .md here"
                hint="or click to browse · semicolon-separated forbidden terms in CSV"
                accept=".csv,.md"
                onFiles={handleCompanyGlossaryFiles}
                disabled={busy || !connected}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  kind="ghost"
                  size="sm"
                  onClick={async () => {
                    const picked = await browseGlossary();
                    if (!picked) return;
                    void handleCompanyGlossaryFiles([
                      new File([picked.content], picked.filename, {
                        type: picked.format === "csv" ? "text/csv" : "text/markdown"
                      })
                    ]);
                  }}
                  disabled={busy || !connected}
                >
                  Browse…
                </Button>
              </div>
              {(tree?.companyGlossary.length ?? 0) > 0 ? (
                <Tile>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <strong>company-glossary</strong>
                    <StatusPill status="ok" />
                    <span style={{ fontSize: "0.875rem", color: "var(--cds-text-secondary)" }}>
                      {tree?.companyGlossary.length} terms
                    </span>
                    <span style={{ marginLeft: "auto" }}>
                      <Button
                        kind="danger--ghost"
                        size="sm"
                        disabled={busy || !connected}
                        onClick={() => {
                          if (!window.confirm("Delete company glossary? This removes the file from disk.")) return;
                          setBusy(true);
                          void client
                            .deleteCompanyGlossary()
                            .then(() => load())
                            .catch((err) => setError(err instanceof Error ? err.message : String(err)))
                            .finally(() => setBusy(false));
                        }}
                      >
                        Delete
                      </Button>
                    </span>
                  </div>
                </Tile>
              ) : (
                <Tile>
                  <p style={{ color: "var(--cds-text-helper)" }}>No company glossary yet.</p>
                </Tile>
              )}
            </WriterPageStack>
          </section>

          <section>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "1rem",
                marginBottom: "1rem"
              }}
            >
              <WriterSectionHeader title="Products" />
              <Button kind="primary" size="sm" disabled={busy || !connected} onClick={() => setAddProductOpen(true)}>
                Add product
              </Button>
            </div>

            {tree && tree.products.length === 0 && (
              <Tile>
                <p style={{ color: "var(--cds-text-helper)" }}>
                  No products yet. Add a product with a required background.md.
                </p>
              </Tile>
            )}

            <Accordion>
              {tree?.products.map((item) => (
                <AccordionItem
                  key={item.id}
                  title={
                    <span style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <strong>{item.name}</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--cds-text-helper)" }}>{item.id}</span>
                      <StatusPill status={item.parseStatus} />
                    </span>
                  }
                >
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const files = Array.from(e.dataTransfer.files);
                      if (files.length) void handleProductFiles(item.id, item)(files);
                    }}
                    style={{ marginBottom: "1rem" }}
                  >
                    <DropZone
                      label={`Drop files on ${item.id}`}
                      hint="background.md · glossary.csv/.md · writing-guide.md"
                      accept=".md,.csv,text/markdown,text/csv"
                      onFiles={(files) => void handleProductFiles(item.id, item)(files)}
                      disabled={busy || !connected}
                    />
                  </div>

                  {item.parseStatus === "error" && item.parseError && (
                    <InlineNotification
                      kind="error"
                      title="Parse error"
                      subtitle={`${item.parseError.file}${item.parseError.line ? `:${item.parseError.line}` : ""} — ${item.parseError.message}`}
                      lowContrast
                      hideCloseButton
                    />
                  )}

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

                  <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      kind="danger--tertiary"
                      size="sm"
                      disabled={busy || !connected}
                      renderIcon={TrashCan}
                      onClick={() => setDeleteProductId(item.id)}
                    >
                      Delete product
                    </Button>
                  </div>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        </WriterPageStack>

        {overwritePending && (
          <Modal
            open
            danger
            modalHeading="Replace existing file?"
            primaryButtonText="Replace"
            secondaryButtonText="Cancel"
            primaryButtonDisabled={busy}
            onRequestSubmit={() => void runUpload(overwritePending, true)}
            onRequestClose={() => setOverwritePending(null)}
          >
            <p>
              <strong>{overwritePending.label}</strong> already exists. Replacing will overwrite the current file on
              disk. This cannot be undone.
            </p>
          </Modal>
        )}

        {deleteProductId && (
          <Modal
            open
            danger
            modalHeading="Delete product?"
            primaryButtonText="Delete"
            secondaryButtonText="Cancel"
            primaryButtonDisabled={busy}
            onRequestSubmit={() => void confirmDeleteProduct()}
            onRequestClose={() => setDeleteProductId(null)}
          >
            <p>
              Delete product <strong>{deleteProductId}</strong> and all of its files (background, glossary, writing
              guide)? This cannot be undone.
            </p>
          </Modal>
        )}

        {viewProductId && (
          <Modal
            open
            modalHeading={`Background — ${viewProductId}`}
            passiveModal
            onRequestClose={() => {
              setViewProductId(null);
              setViewBackgroundBody(null);
            }}
          >
            <TextArea
              id="view-background-body"
              labelText="Body"
              value={viewBackgroundBody ?? ""}
              readOnly
              rows={16}
            />
          </Modal>
        )}

        {addProductOpen && (
          <Modal
            open
            modalHeading="Add product"
            primaryButtonText={busy ? "Creating…" : "Create"}
            secondaryButtonText="Cancel"
            primaryButtonDisabled={busy || !newProductId.trim()}
            onRequestSubmit={() => void submitAddProduct()}
            onRequestClose={() => setAddProductOpen(false)}
          >
            <WriterPageStack gap={4}>
              <TextInput
                id="new-product-id"
                labelText="Product id"
                value={newProductId}
                onChange={(e) => setNewProductId(e.target.value.replace(/[^a-zA-Z0-9-_]/g, "-"))}
                helperText="Folder name under products/ (letters, numbers, - and _)"
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button
                  kind={addMode === "form" ? "primary" : "tertiary"}
                  size="sm"
                  onClick={() => setAddMode("form")}
                >
                  Form
                </Button>
                <Button
                  kind={addMode === "file" ? "primary" : "tertiary"}
                  size="sm"
                  onClick={() => setAddMode("file")}
                >
                  Upload background.md
                </Button>
              </div>
              {addMode === "form" ? (
                <>
                  <TextInput
                    id="new-audience"
                    labelText="Audience"
                    value={newAudience}
                    onChange={(e) => setNewAudience(e.target.value)}
                  />
                  <TextInput
                    id="new-environment"
                    labelText="Environment"
                    value={newEnvironment}
                    onChange={(e) => setNewEnvironment(e.target.value)}
                  />
                  <TextInput
                    id="new-purpose"
                    labelText="Purpose"
                    value={newPurpose}
                    onChange={(e) => setNewPurpose(e.target.value)}
                  />
                  <TextArea
                    id="new-body"
                    labelText="Background body (markdown)"
                    value={newBody}
                    onChange={(e) => setNewBody(e.target.value)}
                    rows={6}
                  />
                  <a
                    href={client.productBackgroundTemplateUrl()}
                    download="product-background-template.md"
                    style={{ fontSize: "0.875rem" }}
                  >
                    Download background template
                  </a>
                </>
              ) : (
                <>
                  <Button
                    kind="secondary"
                    size="sm"
                    onClick={async () => {
                      const picked = await browseMarkdown();
                      if (picked) setNewBackgroundFile(picked);
                    }}
                  >
                    Choose background.md…
                  </Button>
                  {newBackgroundFile && (
                    <p style={{ fontSize: "0.875rem", color: "var(--cds-text-helper)" }}>
                      File: <code>{newBackgroundFile.filename}</code>
                    </p>
                  )}
                </>
              )}
            </WriterPageStack>
          </Modal>
        )}
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
      <div style={{ display: "flex", alignItems: "baseline", gap: "1rem", marginBottom: "1rem" }}>
        <WriterSectionHeader title={title} />
        <a href={templateHref} download={templateName} style={{ fontSize: "0.875rem" }}>
          Download template
        </a>
      </div>
      <WriterPageStack gap={4}>
        {missing && (
          <InlineNotification kind="warning" title="Missing" subtitle={missingHint} lowContrast />
        )}
        <DropZone label={dropLabel} hint={dropHint} accept={accept} onFiles={onFiles} disabled={busy || !connected} />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button kind="ghost" size="sm" onClick={() => void onBrowse()} disabled={busy || !connected}>
            Browse…
          </Button>
        </div>
        {guideline ? (
          <GuidelineTile guideline={guideline} />
        ) : (
          <Tile>
            <p style={{ color: "var(--cds-text-helper)" }}>Not uploaded yet.</p>
          </Tile>
        )}
      </WriterPageStack>
    </section>
  );
}

function GuidelineTile({ guideline }: { guideline: Guideline }) {
  return (
    <Tile>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
        <strong>{guideline.id}</strong>
        <span style={{ fontSize: "0.75rem", color: "var(--cds-text-helper)" }}>{guideline.layer}</span>
        <StatusPill status="ok" />
        <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--cds-text-helper)" }}>
          v{guideline.version}
        </span>
      </div>
      <div style={{ fontSize: "0.875rem", color: "var(--cds-text-secondary)" }}>
        {guideline.rules.length} rules · {guideline.glossary.length} terms
      </div>
    </Tile>
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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.75rem 0",
        borderBottom: "1px solid var(--cds-border-subtle)"
      }}
    >
      <span style={{ minWidth: "7rem", fontWeight: 600 }}>{label}</span>
      <StatusPill status={filled ? "ok" : "incomplete"} />
      <span style={{ fontSize: "0.875rem", color: "var(--cds-text-helper)" }}>{filled ? "Uploaded" : "Empty"}</span>
      <span style={{ marginLeft: "auto", display: "flex", gap: "0.25rem" }}>
        {filled && onOpen && (
          <Button kind="ghost" size="sm" disabled={busy || !connected} onClick={onOpen}>
            Open
          </Button>
        )}
        <Button kind="ghost" size="sm" disabled={busy || !connected} onClick={() => void onReplace()}>
          {filled ? "Replace" : "Upload"}
        </Button>
        {filled && canDelete && onDelete && (
          <Button kind="danger--ghost" size="sm" disabled={busy || !connected} onClick={onDelete}>
            Delete
          </Button>
        )}
      </span>
    </div>
  );
}
