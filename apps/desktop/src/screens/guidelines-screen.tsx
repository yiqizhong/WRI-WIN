import { useCallback, useEffect, useState } from "react";

import { Button, InlineNotification, Tile } from "@carbon/react";

import type { GuidelineList } from "../daemon-client";
import { WriterPageGrid, WriterPageGridFull, WriterPageStack } from "../layout/writer-grid";
import { WriterSectionHeader } from "../layout/writer-headings";
import { useWorkspace } from "../workspace-context";

const RULE_WARN_THRESHOLD = 200;
const PROSE_BYTES_WARN_THRESHOLD = 50 * 1024;

function GuidelineStatusBadge({ status }: { status: "ok" | "error" }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0 0.5rem",
        borderRadius: "0.25rem",
        fontSize: "0.75rem",
        background: status === "ok" ? "var(--cds-support-success)" : "var(--cds-support-error)",
        color: "#fff"
      }}
    >
      {status === "ok" ? "OK" : "Parse error"}
    </span>
  );
}

type GuidelineListItem = GuidelineList["guidelines"][number];

function GuidelineTile({ item }: { item: GuidelineListItem }) {
  const totalRules = item.ruleCount;
  const overLimit = totalRules >= RULE_WARN_THRESHOLD;

  return (
    <Tile style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <strong>{item.id}</strong>
        <span style={{ color: "var(--cds-text-helper)", fontSize: "0.75rem" }}>
          {item.scope}
        </span>
        <GuidelineStatusBadge status={item.parseStatus} />
        <span style={{ marginLeft: "auto", color: "var(--cds-text-helper)", fontSize: "0.75rem" }}>
          v{item.version}
        </span>
      </div>

      <div style={{ color: "var(--cds-text-secondary)", fontSize: "0.875rem" }}>
        {item.ruleCount} rule{item.ruleCount !== 1 ? "s" : ""} ·{" "}
        {item.termCount} term{item.termCount !== 1 ? "s" : ""}
      </div>

      {item.parseStatus === "error" && item.parseError && (
        <>
          <InlineNotification
            kind="error"
            title="Parse error"
            subtitle={`${item.parseError.file}${item.parseError.line ? `:${item.parseError.line}` : ""} — ${item.parseError.message}`}
            lowContrast
          />
          <Button
            kind="ghost"
            size="sm"
            onClick={() => {
              void window.writerDesktop?.openExternal(`file://${item.parseError!.file}`);
            }}
          >
            Open in editor
          </Button>
        </>
      )}

      {overLimit && item.parseStatus === "ok" && (
        <InlineNotification
          kind="warning"
          title="Corpus near linear-scan limit"
          subtitle={`${item.ruleCount} rules — performance may degrade past ${RULE_WARN_THRESHOLD} rules or ${PROSE_BYTES_WARN_THRESHOLD / 1024}KB prose.`}
          lowContrast
        />
      )}
    </Tile>
  );
}

export function GuidelinesScreen() {
  const workspace = useWorkspace();
  const [list, setList] = useState<GuidelineList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await workspace.daemonClient.listGuidelines();
      setList(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load guidelines.");
    } finally {
      setLoading(false);
    }
  }, [workspace.daemonClient]);

  useEffect(() => {
    if (workspace.daemonConnected) {
      void load();
    }
  }, [workspace.daemonConnected, load]);

  const handleReload = async () => {
    setLoading(true);
    try {
      await workspace.daemonClient.reloadGuidelines();
      await load();
    } finally {
      setLoading(false);
    }
  };

  return (
    <WriterPageGrid gutterMode="narrow">
      <WriterPageGridFull>
        <WriterPageStack gap={5}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <WriterSectionHeader title="Guidelines" />
            <Button
              kind="ghost"
              size="sm"
              onClick={() => void handleReload()}
              disabled={loading || !workspace.daemonConnected}
            >
              {loading ? "Reloading…" : "Reload"}
            </Button>
          </div>

          {error && (
            <InlineNotification kind="error" title="Error" subtitle={error} lowContrast />
          )}

          {list?.companyMissing && (
            <InlineNotification
              kind="warning"
              title="Company guidelines missing"
              subtitle="Create ~/.writer/guidelines/company.md to enable guideline-grounded audits."
              lowContrast
            />
          )}

          {!list && !loading && !error && (
            <p style={{ color: "var(--cds-text-helper)" }}>
              {workspace.daemonConnected ? "Loading…" : "Daemon not connected."}
            </p>
          )}

          {list?.guidelines.map((item) => (
            <GuidelineTile key={item.id} item={item} />
          ))}

          {list && list.guidelines.length === 0 && !list.companyMissing && (
            <Tile>
              <p style={{ color: "var(--cds-text-helper)" }}>No guidelines found.</p>
            </Tile>
          )}
        </WriterPageStack>
      </WriterPageGridFull>
    </WriterPageGrid>
  );
}
