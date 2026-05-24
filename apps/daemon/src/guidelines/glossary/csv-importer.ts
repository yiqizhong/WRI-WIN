import type { Term } from "@writer/contracts";
import { termSchema } from "@writer/contracts";

export type CsvParseResult =
  | { ok: true; terms: Term[] }
  | { ok: false; line: number; message: string };

const HEADERS = ["id", "term", "status", "forbidden", "replacement", "caseSensitive", "reason"];

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseGlossaryCsv(content: string): CsvParseResult {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { ok: true, terms: [] };

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  for (const required of ["id", "term"]) {
    if (!header.includes(required)) {
      return { ok: false, line: 1, message: `Missing required column "${required}"` };
    }
  }

  const terms: Term[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    header.forEach((key, idx) => {
      row[key] = cols[idx] ?? "";
    });

    const forbidden = row.forbidden
      ? row.forbidden.split(";").map((s) => s.trim()).filter(Boolean)
      : undefined;

    const candidate = {
      id: row.id,
      term: row.term,
      status: (row.status || "active") as "active" | "deprecated",
      forbidden,
      forbiddenReplacement: row.replacement || undefined,
      caseSensitive:
        row.casesensitive === "true" || row.casesensitive === "1" || row.casesensitive === "yes",
      reason: row.reason || undefined
    };

    const parsed = termSchema.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        ok: false,
        line: i + 1,
        message: `Row ${i}: ${issue.path.join(".")} — ${issue.message}`
      };
    }
    terms.push(parsed.data);
  }

  const seen = new Set<string>();
  for (const term of terms) {
    if (seen.has(term.id)) {
      return { ok: false, line: 0, message: `Duplicate term id "${term.id}"` };
    }
    seen.add(term.id);
  }

  return { ok: true, terms };
}

export const GLOSSARY_CSV_TEMPLATE = `id,term,status,forbidden,replacement,caseSensitive,reason
sign-in,Sign in,active,Login;Log in,Sign in,false,Two-word lowercase form
email-address,email address,active,e-mail;Email Address,email address,false,Hyphenated form is dated
`;

export const GLOSSARY_MD_TEMPLATE = `---
id: my-glossary
name: My Glossary
schema: 1
version: "1.0.0"
updatedAt: "${new Date().toISOString()}"
---

Standalone glossary file. Only the \`## Glossary\` block is used.

## Glossary

- id: sign-in
  term: Sign in
  status: active
  forbidden:
    - Login
    - Log in
  caseSensitive: false
  reason: Two-word lowercase form is consistent with platform conventions.
`;
