import { useEffect, useState } from "react";

import type { DaemonClient } from "./daemon-client";

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
    <section className="panel changelog-panel">
      <p className="eyebrow">Writeback trail</p>
      <h2>Session changelog</h2>
      {!sessionId ? (
        <p className="queue-empty">Select a session to view audit events.</p>
      ) : entries.length === 0 ? (
        <p className="queue-empty">No changelog entries yet for this session.</p>
      ) : (
        <ul className="changelog-list">
          {entries.map((entry, index) => (
            <li key={`${entry.timestamp}-${index}`}>
              <time dateTime={entry.timestamp}>{new Date(entry.timestamp).toLocaleString()}</time>
              <span>{entry.summary}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
