# Verification: text-copy-chat-redesign

**Change:** `text-copy-chat-redesign`  
**Verified at:** 2026-05-25  
**Verifier:** Cursor agent + user manual sign-off (WRI-132)

## Automated

```bash
npm run typecheck
npm run test
openspec validate text-copy-chat-redesign --strict
```

Results (2026-05-25):

- `npm run typecheck` — pass (all workspaces)
- `npm run test` — pass (all workspaces)
- `openspec validate text-copy-chat-redesign --strict` — valid

## Manual (WRI-132)

User confirmed pass for:

1. Home → `/text-copy` — greeting, product picker, optional skip
2. With product — send copy, thinking ribbon phases, rewrite + copy
3. Plus-menu — spreadsheet (`.csv`) and text file (`.md`) attachments
4. Zero products — **Start audit** without product-specific guidelines
5. Daemon disconnected — composer/attach disabled with messaging
6. New conversation during pending rewrite — confirm dialog
7. `/settings?tab=review` — legacy Card still works

## Delta specs

| Capability | Action |
|------------|--------|
| `paste-text-chat` | New main spec (v1 + v2 delta) |
| `desktop-shell` | ADDED Text Copy route, picker, ribbon, plus-menu |

## Linear

Epic [WRI-126](https://linear.app/uicb/issue/WRI-126) — children WRI-127..WRI-132 Done; WRI-133 docs/archive.
