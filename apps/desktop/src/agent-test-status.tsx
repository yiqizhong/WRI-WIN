export type AgentTestStatus = {
  kind: "info" | "success" | "error";
  text: string;
};

type AgentTestStatusBannerProps = {
  status: AgentTestStatus | null;
};

export function AgentTestStatusBanner({ status }: AgentTestStatusBannerProps) {
  if (!status) {
    return null;
  }

  return (
    <p className={`agent-test-status agent-test-status-${status.kind}`} role="status" aria-live="polite">
      {status.text}
    </p>
  );
}
