import { useCallback, useEffect, useRef, useState } from "react";

import {
  Button,
  InlineNotification,
  Modal,
  RadioButton,
  RadioButtonGroup,
  TextInput,
  Tile
} from "@carbon/react";
import { TrashCan } from "@carbon/icons-react";

import type { GlossaryList, GuidelineList } from "../daemon-client";
import { WriterPageGrid, WriterPageGridFull, WriterPageStack } from "../layout/writer-grid";
import { WriterSectionHeader } from "../layout/writer-headings";
import { useWorkspace } from "../workspace-context";

type GuidelineItem = GuidelineList["guidelines"][number];
type GlossaryItem = GlossaryList["glossaries"][number];

type PendingGuideline = { filename: string; content: string } | null;
type PendingGlossary = { filename: string; content: string; format: "csv" | "md" } | null;

function StatusPill({ status }: { status: "ok" | "error" }) {
  return (
    <span
      style={{
        padding: "0 0.5rem",
        borderRadius: "0.25rem",
        fontSize: "0.75rem",
        fontWeight: 600,
        background: status === "ok" ? "var(--cds-support-success)" : "var(--cds-support-error)",
        color: "#fff"
      }}
    >
      {status === "ok" ? "OK" : "ERROR"}
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

export function GuidelinesScreen() {
  const workspace = useWorkspace();
  const client = workspace.daemonClient;
  const connected = workspace.daemonConnected;

  const [guidelines, setGuidelines] = useState<GuidelineList | null>(null);
  const [glossaries, setGlossaries] = useState<GlossaryList | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [pendingGuideline, setPendingGuideline] = useState<PendingGuideline>(null);
  const [guidelineScope, setGuidelineScope] = useState<"company" | "product">("product");
  const [productName, setProductName] = useState("");

  const [pendingGlossary, setPendingGlossary] = useState<PendingGlossary>(null);
  const [glossaryName, setGlossaryName] = useState("");

  const [overwriteConfirm, setOverwriteConfirm] = useState<null | { kind: "guideline" | "glossary" }>(null);

  const load = useCallback(async () => {
    if (!connected) return;
    setError(null);
    try {
      const [g, gl] = await Promise.all([client.listGuidelines(), client.listGlossaries()]);
      setGuidelines(g);
      setGlossaries(gl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    }
  }, [client, connected]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleGuidelineFiles = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!file.name.endsWith(".md") && file.type !== "text/markdown") {
      setError(`Only .md files are supported. Got: ${file.name}`);
      return;
    }
    const content = await readFileAsText(file);
    const defaultName = file.name.replace(/\.md$/, "");
    setProductName(defaultName);
    setGuidelineScope("product");
    setPendingGuideline({ filename: file.name, content });
  }, []);

  const handleGlossaryFiles = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const isCsv = file.name.endsWith(".csv");
    const isMd = file.name.endsWith(".md");
    if (!isCsv && !isMd) {
      setError(`Only .csv or .md files are supported. Got: ${file.name}`);
      return;
    }
    const content = await readFileAsText(file);
    setGlossaryName(file.name.replace(/\.(csv|md)$/, ""));
    setPendingGlossary({ filename: file.name, content, format: isCsv ? "csv" : "md" });
  }, []);

  const browseGuideline = useCallback(async () => {
    const picked = await window.writerDesktop?.pickGuidelineFile();
    if (!picked) return;
    setGuidelineScope("product");
    setProductName(picked.filename.replace(/\.md$/, ""));
    setPendingGuideline(picked);
  }, []);

  const browseGlossary = useCallback(async () => {
    const picked = await window.writerDesktop?.pickGlossaryFile();
    if (!picked) return;
    setGlossaryName(picked.filename.replace(/\.(csv|md)$/, ""));
    setPendingGlossary(picked);
  }, []);

  const submitGuideline = useCallback(
    async (overwrite: boolean) => {
      if (!pendingGuideline) return;
      const filename =
        guidelineScope === "company" ? "company.md" : `${productName.trim() || "guideline"}.md`;
      setBusy(true);
      setError(null);
      setInfo(null);
      try {
        await client.uploadGuideline({
          filename,
          content: pendingGuideline.content,
          scope: guidelineScope,
          overwrite
        });
        setPendingGuideline(null);
        setOverwriteConfirm(null);
        setInfo(`Uploaded: ${filename}`);
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/already exists/i.test(msg) || /conflict/i.test(msg)) {
          setOverwriteConfirm({ kind: "guideline" });
        } else {
          setError(msg);
        }
      } finally {
        setBusy(false);
      }
    },
    [client, guidelineScope, load, pendingGuideline, productName]
  );

  const submitGlossary = useCallback(
    async (overwrite: boolean) => {
      if (!pendingGlossary) return;
      const name = glossaryName.trim() || "glossary";
      const filename = `${name}.${pendingGlossary.format}`;
      setBusy(true);
      setError(null);
      setInfo(null);
      try {
        await client.uploadGlossary({
          filename,
          content: pendingGlossary.content,
          format: pendingGlossary.format,
          overwrite
        });
        setPendingGlossary(null);
        setOverwriteConfirm(null);
        setInfo(`Uploaded: ${filename}`);
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/already exists/i.test(msg) || /conflict/i.test(msg)) {
          setOverwriteConfirm({ kind: "glossary" });
        } else {
          setError(msg);
        }
      } finally {
        setBusy(false);
      }
    },
    [client, glossaryName, load, pendingGlossary]
  );

  const deleteGuideline = useCallback(
    async (id: string) => {
      if (!window.confirm(`Delete guideline "${id}"? This removes the file from disk.`)) return;
      setBusy(true);
      try {
        await client.deleteGuideline(id);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [client, load]
  );

  const deleteGlossary = useCallback(
    async (id: string) => {
      if (!window.confirm(`Delete glossary "${id}"?`)) return;
      setBusy(true);
      try {
        await client.deleteGlossary(id);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [client, load]
  );

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

          {/* Guidelines section */}
          <section>
            <div style={{ display: "flex", alignItems: "baseline", gap: "1rem", marginBottom: "1rem" }}>
              <WriterSectionHeader title="Guidelines" />
              <a
                href={client.guidelineTemplateUrl()}
                download="guideline-template.md"
                style={{ fontSize: "0.875rem" }}
              >
                Download .md template
              </a>
            </div>

            <WriterPageStack gap={4}>
              <DropZone
                label="Drop a .md guideline file here"
                hint="or click to browse · or paste markdown text"
                accept=".md,text/markdown"
                onFiles={handleGuidelineFiles}
                disabled={busy || !connected}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button kind="ghost" size="sm" onClick={() => void browseGuideline()} disabled={busy || !connected}>
                  Browse…
                </Button>
              </div>

              {guidelines?.companyMissing && (
                <InlineNotification
                  kind="warning"
                  title="Company guideline missing"
                  subtitle="Upload a company.md to enable guideline-grounded audits."
                  lowContrast
                />
              )}

              {guidelines?.guidelines.map((item) => (
                <GuidelineTileView key={item.id} item={item} onDelete={() => void deleteGuideline(item.id)} canDelete={item.id !== "company"} busy={busy} />
              ))}

              {guidelines && guidelines.guidelines.length === 0 && !guidelines.companyMissing && (
                <Tile>
                  <p style={{ color: "var(--cds-text-helper)" }}>No guidelines uploaded yet.</p>
                </Tile>
              )}
            </WriterPageStack>
          </section>

          {/* Glossary section */}
          <section>
            <div style={{ display: "flex", alignItems: "baseline", gap: "1rem", marginBottom: "1rem" }}>
              <WriterSectionHeader title="Glossaries" />
              <a
                href={client.glossaryTemplateUrl()}
                download="glossary-template.csv"
                style={{ fontSize: "0.875rem" }}
              >
                Download .csv template
              </a>
            </div>

            <WriterPageStack gap={4}>
              <DropZone
                label="Drop a .csv or .md glossary file here"
                hint="or click to browse · separate forbidden terms with semicolons in CSV"
                accept=".csv,.md"
                onFiles={handleGlossaryFiles}
                disabled={busy || !connected}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button kind="ghost" size="sm" onClick={() => void browseGlossary()} disabled={busy || !connected}>
                  Browse…
                </Button>
              </div>

              {glossaries?.glossaries.map((item) => (
                <GlossaryTileView key={item.id} item={item} onDelete={() => void deleteGlossary(item.id)} busy={busy} />
              ))}

              {glossaries && glossaries.glossaries.length === 0 && (
                <Tile>
                  <p style={{ color: "var(--cds-text-helper)" }}>No standalone glossaries uploaded yet.</p>
                </Tile>
              )}
            </WriterPageStack>
          </section>
        </WriterPageStack>

        {/* Upload guideline modal */}
        {pendingGuideline && (
          <Modal
            open
            modalHeading="Upload guideline"
            primaryButtonText={busy ? "Uploading…" : "Upload"}
            secondaryButtonText="Cancel"
            primaryButtonDisabled={busy || (guidelineScope === "product" && !productName.trim())}
            onRequestSubmit={() => void submitGuideline(false)}
            onRequestClose={() => setPendingGuideline(null)}
          >
            <div style={{ marginBottom: "1rem", color: "var(--cds-text-helper)", fontSize: "0.875rem" }}>
              File: <code>{pendingGuideline.filename}</code> ({(pendingGuideline.content.length / 1024).toFixed(1)} KB)
            </div>
            <RadioButtonGroup
              name="scope"
              legendText="Scope"
              valueSelected={guidelineScope}
              onChange={(value) => setGuidelineScope(value as "company" | "product")}
            >
              <RadioButton labelText="Company-wide" value="company" id="scope-company" />
              <RadioButton labelText="Product-specific" value="product" id="scope-product" />
            </RadioButtonGroup>
            {guidelineScope === "product" && (
              <div style={{ marginTop: "1rem" }}>
                <TextInput
                  id="product-name"
                  labelText="Product name (used as filename)"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, "-"))}
                  helperText="Becomes products/<name>.md"
                />
              </div>
            )}
          </Modal>
        )}

        {/* Upload glossary modal */}
        {pendingGlossary && (
          <Modal
            open
            modalHeading="Upload glossary"
            primaryButtonText={busy ? "Uploading…" : "Upload"}
            secondaryButtonText="Cancel"
            primaryButtonDisabled={busy || !glossaryName.trim()}
            onRequestSubmit={() => void submitGlossary(false)}
            onRequestClose={() => setPendingGlossary(null)}
          >
            <div style={{ marginBottom: "1rem", color: "var(--cds-text-helper)", fontSize: "0.875rem" }}>
              File: <code>{pendingGlossary.filename}</code> · format: <code>{pendingGlossary.format}</code>
            </div>
            <TextInput
              id="glossary-name"
              labelText="Glossary name (used as filename)"
              value={glossaryName}
              onChange={(e) => setGlossaryName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, "-"))}
              helperText={`Becomes glossary/<name>.${pendingGlossary.format}`}
            />
          </Modal>
        )}

        {/* Overwrite confirmation modal */}
        {overwriteConfirm && (
          <Modal
            open
            danger
            modalHeading="File already exists"
            primaryButtonText="Replace"
            secondaryButtonText="Cancel"
            onRequestSubmit={() =>
              overwriteConfirm.kind === "guideline" ? void submitGuideline(true) : void submitGlossary(true)
            }
            onRequestClose={() => setOverwriteConfirm(null)}
          >
            <p>
              A file with this name already exists. Replacing will overwrite the current contents. This action cannot
              be undone.
            </p>
          </Modal>
        )}
      </WriterPageGridFull>
    </WriterPageGrid>
  );
}

function GuidelineTileView({
  item,
  onDelete,
  canDelete,
  busy
}: {
  item: GuidelineItem;
  onDelete: () => void;
  canDelete: boolean;
  busy: boolean;
}) {
  return (
    <Tile>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
        <strong>{item.id}</strong>
        <span style={{ fontSize: "0.75rem", color: "var(--cds-text-helper)" }}>{item.scope}</span>
        <StatusPill status={item.parseStatus} />
        <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--cds-text-helper)" }}>v{item.version}</span>
        {canDelete && (
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            iconDescription="Delete"
            renderIcon={TrashCan}
            onClick={onDelete}
            disabled={busy}
          />
        )}
      </div>
      <div style={{ fontSize: "0.875rem", color: "var(--cds-text-secondary)" }}>
        {item.ruleCount} rules · {item.termCount} terms
      </div>
      {item.parseStatus === "error" && item.parseError && (
        <div style={{ marginTop: "0.5rem" }}>
          <InlineNotification
            kind="error"
            title="Parse error"
            subtitle={`${item.parseError.file}${item.parseError.line ? `:${item.parseError.line}` : ""} — ${item.parseError.message}`}
            lowContrast
            hideCloseButton
          />
        </div>
      )}
    </Tile>
  );
}

function GlossaryTileView({
  item,
  onDelete,
  busy
}: {
  item: GlossaryItem;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <Tile>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
        <strong>{item.name}</strong>
        <span style={{ fontSize: "0.75rem", color: "var(--cds-text-helper)" }}>.{item.format}</span>
        <StatusPill status={item.parseStatus} />
        <span style={{ marginLeft: "auto" }}>
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            iconDescription="Delete"
            renderIcon={TrashCan}
            onClick={onDelete}
            disabled={busy}
          />
        </span>
      </div>
      <div style={{ fontSize: "0.875rem", color: "var(--cds-text-secondary)" }}>{item.termCount} terms</div>
      {item.parseStatus === "error" && item.parseError && (
        <div style={{ marginTop: "0.5rem" }}>
          <InlineNotification
            kind="error"
            title="Parse error"
            subtitle={`${item.parseError.file}${item.parseError.line ? `:${item.parseError.line}` : ""} — ${item.parseError.message}`}
            lowContrast
            hideCloseButton
          />
        </div>
      )}
    </Tile>
  );
}
