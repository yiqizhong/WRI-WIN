import { InlineAlert } from "@/components/writer/inline-alert";

export type AgentTestStatus = {
  kind: "info" | "success" | "error";
  text: string;
};

type AgentTestStatusBannerProps = {
  status: AgentTestStatus | null;
  onDismiss?: () => void;
};

export function AgentTestStatusBanner({ status, onDismiss }: AgentTestStatusBannerProps) {
  if (!status) {
    return null;
  }

  const kind = status.kind === "success" ? "success" : status.kind === "error" ? "error" : "info";

  return (
    <InlineAlert
      kind={kind}
      title="Connection test"
      subtitle={status.text}
      onClose={onDismiss}
    />
  );
}
