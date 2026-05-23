// artifacts/skeletons/Agents.tsx · Architect Pass 3

/**
 * Intent:
 * - Operator screen — LLM + MCP isolated from Review (design goal 5)
 * - RadioButtonGroup for providers (cursor-agent, devin only)
 * - Toggle MCP enable · Connect Figma · Test read
 * - Single InlineNotification / status banner region (A4)
 */

import {
  Button,
  RadioButton,
  RadioButtonGroup,
  Stack,
  Tile,
  Toggle,
  Tag
} from "@carbon/react";

export default function Agents() {
  return (
    <Stack gap={7}>
      {/* @builder: AgentTestStatusBanner equivalent — one region only */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "var(--cds-spacing-06)"
        }}
      >
        <Tile>
          <Stack gap={5}>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>LLM providers</h2>
            {/* @builder: RadioButtonGroup name="active-adapter" — cursor-agent, devin; test connection per row */}
            <RadioButtonGroup name="active-adapter" legendText="Active provider" defaultSelected="cursor-agent">
              <RadioButton labelText="Cursor Agent" value="cursor-agent" id="adapter-cursor" />
              <RadioButton labelText="Devin (cloud-backed)" value="devin" id="adapter-devin" />
            </RadioButtonGroup>
            <Button kind="secondary" size="sm">
              Refresh detection
            </Button>
          </Stack>
        </Tile>

        <Tile>
          <Stack gap={5}>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>MCP servers</h2>
            <Stack gap={3} orientation="horizontal" style={{ justifyContent: "space-between" }}>
              <span>Figma MCP</span>
              <Toggle id="figma-mcp-toggle" labelText="" hideLabel toggled={false} />
            </Stack>
            <Tag type="gray">disconnected</Tag>
            <Stack gap={3} orientation="horizontal">
              <Button kind="secondary">Connect Figma</Button>
              <Button kind="secondary">Test Figma read</Button>
            </Stack>
          </Stack>
        </Tile>
      </div>
    </Stack>
  );
}
