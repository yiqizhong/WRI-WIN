# Verification: guidelines-runtime

## Automated

```bash
npm install
npm run typecheck
npm run test
```

## Manual

1. Start daemon with an empty `~/.writer/guidelines/`. Confirm the daemon scaffolds the directory with a starter `company.md`.
2. Open desktop → **Guidelines** screen. Confirm the company tile shows `parseStatus: ok` and non-zero rule and term counts.
3. Edit `company.md` and introduce a YAML syntax error in one rule. Save.
4. Within ~2 seconds desktop shows a parse error tile with the file path and line number. Confirm "Open in editor" launches the OS default editor and "Reveal in Finder" opens Finder.
5. Fix the error and save. Confirm the Guidelines screen returns to OK state without manual reload.
6. Create `~/.writer/guidelines/products/checkout.md` with one new rule. Confirm desktop lists it; its rules include the inherited company rules marked with the inherited badge.
7. On a project, select `checkout` as the active guideline. Start a new audit session against a Figma frame.
8. Run the audit. Confirm each finding card displays the rule (or term) it references and clicking it navigates to the rule detail.
9. Using a stub adapter, force a finding with a fabricated `ruleId`. Confirm it is dropped and the audit log records `invalid_rule_id`.
10. Edit `checkout.md` while the audit session is still open. Re-run audit on that same session. Confirm findings reflect the snapshot, not the edited file.
11. Add a forbidden glossary term that appears literally in the audited frame. Confirm a deterministic finding tagged `source: 'glossary'` appears without an LLM call.

## Security

- Confirm guideline files are read-only from the renderer (no IPC for writes).
- Confirm the parser does not execute embedded code blocks (Markdown is parsed, never evaluated).
- Confirm the daemon refuses to read symlinks pointing outside `~/.writer/guidelines/`.
