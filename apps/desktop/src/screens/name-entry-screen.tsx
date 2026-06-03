import { useState, type KeyboardEvent } from "react";

import { InlineAlert } from "@/components/writer/inline-alert";
import { WriterFormField, WriterFormInput } from "@/components/writer/writer-form-field";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";
import { GlassCard } from "@/components/writer/glass-card";

import { useWorkspace } from "../workspace-context";
import { DaemonClientError } from "../daemon-client";

export function NameEntryScreen() {
  const { saveProfile } = useWorkspace();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await saveProfile(trimmed);
    } catch (err) {
      setError(
        err instanceof DaemonClientError
          ? err.message
          : "Something went wrong. Please try again."
      );
      setSubmitting(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="writer-home-text writer-home-heading flex flex-col">
          <span>Welcome to Writer.</span>
        </div>

        <GlassCard className="flex flex-col gap-4 p-4">
          <WriterFormField label="Your name" htmlFor="profile-name">
            <WriterFormInput
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your name"
              disabled={submitting}
              autoFocus
            />
          </WriterFormField>

          {error ? (
            <InlineAlert kind="error" title="Name not recognized" subtitle="Please try again." />
          ) : null}

          <div className="flex justify-end">
            <WriterPrimaryButton
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
            >
              {submitting ? "Saving…" : "Continue"}
            </WriterPrimaryButton>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
