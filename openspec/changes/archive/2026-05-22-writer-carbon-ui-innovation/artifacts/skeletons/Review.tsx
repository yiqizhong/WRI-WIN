// artifacts/skeletons/Review.tsx · Architect Pass 3

/**
 * Intent:
 * - Default landing · human gate queue focal (TaskBreakdown D2)
 * - pattern: Filtering + EmptyStates
 * - StructuredList not DataTable — variable before/after (TaskBreakdown A6)
 * - Session context strip below page title (D6) — Builder in ProductChrome child header
 * - Toolbar band = AABA B unit (surface-1)
 * - One InlineNotification slot (L04)
 *
 * Builder fills: queue data, filter options, bulk/export actions, inline edit
 */

import {
  Button,
  Dropdown,
  InlineNotification,
  Stack,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Tag
} from "@carbon/react";

export default function Review() {
  return (
    <Stack gap={7}>
      {/* @builder: Session context strip — project name, session id (8 chars), source type tag, counts by status */}

      {/* @builder: InlineNotification region — max one; audit/export/smoke messages */}

      <Stack
        gap={5}
        orientation="horizontal"
        style={{
          justifyContent: "space-between",
          flexWrap: "wrap",
          padding: "var(--cds-spacing-05)",
          background: "var(--cds-layer-01)"
        }}
      >
        {/* @builder: Dropdown id="status-filter" labelText="Status" items: all, proposed, approved, ... default proposed */}
        <Dropdown id="status-filter" titleText="Status" label="Filter" items={[]} />
        <Stack gap={3} orientation="horizontal">
          <Button kind="secondary" size="md">
            Run audit
          </Button>
          <Button kind="secondary" size="md">
            Bulk approve visible
          </Button>
          <Button kind="ghost" size="md">
            Export
          </Button>
        </Stack>
      </Stack>

      {/* @builder: EmptyStates — no project / no session / empty filter — use Carbon empty copy, link text to Sources */}

      <StructuredListWrapper>
        <StructuredListHead>
          <StructuredListRow head>
            <StructuredListCell head>Change</StructuredListCell>
            <StructuredListCell head>Status</StructuredListCell>
          </StructuredListRow>
        </StructuredListHead>
        <StructuredListBody>
          {/* @builder: map changes — row: before/after text, Tag status, actions Approve Edit Reject Skip */}
          <StructuredListRow>
            <StructuredListCell>
              <strong>Before</strong> … <br />
              <strong>After</strong> …
            </StructuredListCell>
            <StructuredListCell>
              <Tag type="blue">proposed</Tag>
            </StructuredListCell>
          </StructuredListRow>
        </StructuredListBody>
      </StructuredListWrapper>
    </Stack>
  );
}
