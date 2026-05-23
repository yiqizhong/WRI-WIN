import type { SpreadsheetColumnRole } from "@writer/contracts";

type DetectedColumn = {
  index: number;
  header: string;
  role: SpreadsheetColumnRole;
  confidence: number;
};

const ROLE_HINTS: Record<SpreadsheetColumnRole, RegExp[]> = {
  source: [/source|original|current|before|copy/i],
  suggestion: [/suggest|proposed|after|rewrite|recommended/i],
  status: [/status|state|decision|approval/i],
  note: [/note|comment|rationale|reason/i],
  ignore: []
};

export function detectColumnMapping(headers: string[]): DetectedColumn[] {
  const assigned = new Set<SpreadsheetColumnRole>();

  return headers.map((header, index) => {
    const role = detectRole(header, assigned);
    assigned.add(role);

    return {
      index,
      header,
      role,
      confidence: role === "ignore" ? 0.35 : 0.82
    };
  });
}

function detectRole(header: string, assigned: Set<SpreadsheetColumnRole>): SpreadsheetColumnRole {
  const roles = Object.keys(ROLE_HINTS) as SpreadsheetColumnRole[];

  for (const role of roles) {
    if (role === "ignore" || assigned.has(role)) {
      continue;
    }

    if (ROLE_HINTS[role].some((pattern) => pattern.test(header))) {
      return role;
    }
  }

  if (!assigned.has("source")) {
    return "source";
  }

  return "ignore";
}
