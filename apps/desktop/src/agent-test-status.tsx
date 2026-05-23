import { InlineNotification } from "@carbon/react";

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

  const kind = status.kind === "success" ? "success" : status.kind === "error" ? "error" : "info";

  return (
    <InlineNotification kind={kind} lowContrast title="Connection test" subtitle={status.text} hideCloseButton />
  );
}
