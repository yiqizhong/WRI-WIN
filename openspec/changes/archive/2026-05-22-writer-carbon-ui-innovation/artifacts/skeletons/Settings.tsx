// artifacts/skeletons/Settings.tsx · Architect Pass 3

/**
 * Intent:
 * - Brand voice form (Scenario 5)
 * - Full project path shown here only (TaskBreakdown A5)
 * - pattern: Forms · max width 640px
 */

import { Button, Stack, TextArea } from "@carbon/react";

export default function Settings() {
  return (
    <Stack gap={7} style={{ maxWidth: 640 }}>
      <p style={{ margin: 0, color: "var(--cds-text-secondary)" }}>
        Platform setup for the active project. Connection settings live on{" "}
        <a href="/agents">Agents</a>.
      </p>

      {/* @builder: show active project name + rootPath when set */}

      <TextArea
        id="brand-voice"
        labelText="Brand voice"
        helperText="Friendly, direct, no jargon…"
        rows={4}
        placeholder="Describe tone and terminology for audits."
      />

      <Button kind="secondary">Save guidance</Button>

      {/* @builder: inline error/success InlineNotification on save — not toast (L04) */}
    </Stack>
  );
}
