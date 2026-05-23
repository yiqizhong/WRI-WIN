import { useEffect, useState } from "react";
import { Stack, Tile } from "@carbon/react";

import type { DaemonClient } from "./daemon-client";
import { stackFill, surfaceBody, surfaceFillHeight } from "./layout/writer-sizing";

type ChangelogPanelProps = {
  client: DaemonClient;
  sessionId: string | null;
};

export function ChangelogPanel({ client, sessionId }: ChangelogPanelProps) {
  const [entries, setEntries] = useState<Array<{ summary: string; timestamp: string }>>([]);

  useEffect(() => {
    if (!sessionId) {
      setEntries([]);
      return;
    }

    void (async () => {
      try {
        const changelog = await client.getChangelog(sessionId);
        setEntries(changelog.entries);
      } catch {
        setEntries([]);
      }
    })();
  }, [client, sessionId]);

  return (
    <Tile className={surfaceFillHeight}>
      <Stack gap={5} className={stackFill}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Session changelog</h2>
        {!sessionId ? (
          <p style={{ margin: 0, color: "var(--cds-text-secondary)" }}>Select a session to view audit events.</p>
        ) : entries.length === 0 ? (
          <p style={{ margin: 0, color: "var(--cds-text-secondary)" }}>No changelog entries yet for this session.</p>
        ) : (
          <ul className={surfaceBody} style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {entries.map((entry, index) => (
              <li key={`${entry.timestamp}-${index}`} style={{ marginBlockEnd: "var(--cds-spacing-03)" }}>
                <time dateTime={entry.timestamp} style={{ display: "block", fontSize: "0.75rem", color: "var(--cds-text-secondary)" }}>
                  {new Date(entry.timestamp).toLocaleString()}
                </time>
                <span>{entry.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </Stack>
    </Tile>
  );
}
