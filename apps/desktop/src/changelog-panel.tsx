import { useEffect, useState } from "react";
import { Stack, Tile } from "@carbon/react";

import type { DaemonClient } from "./daemon-client";
import { WriterSectionHeader } from "./layout/writer-headings";
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
        <WriterSectionHeader title="Changelog" />
        {!sessionId ? (
          <p className="writer-type-body-compact writer-text-secondary">No session selected.</p>
        ) : entries.length === 0 ? (
          <p className="writer-type-body-compact writer-text-secondary">No changes.</p>
        ) : (
          <ul className={`${surfaceBody} writer-changelog-list`}>
            {entries.map((entry, index) => (
              <li key={`${entry.timestamp}-${index}`} className="writer-changelog-list__item">
                <time dateTime={entry.timestamp} className="writer-type-helper">
                  {new Date(entry.timestamp).toLocaleString()}
                </time>
                <span className="writer-type-body-compact">{entry.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </Stack>
    </Tile>
  );
}
