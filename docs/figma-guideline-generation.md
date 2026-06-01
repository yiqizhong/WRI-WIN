# Figma Guideline Generation API

This document describes the upgraded Figma guideline generation flow used by the daemon and the desktop **Guide** route (`/guide`).

## Endpoint

- `POST /guidelines/generate/figma`

## Request

```json
{
  "sessionId": "sess_xxx",
  "adapterId": "devin",
  "maxCandidates": 500
}
```

- `sessionId` is required and must point to a Figma session.
- `adapterId` is optional; if omitted, the daemon uses the active adapter.
- `maxCandidates` defaults to `500`.

## Response

```json
{
  "ok": true,
  "sessionId": "sess_xxx",
  "candidatePackage": { "...": "..." },
  "semanticAnalysis": { "...": "..." },
  "generationSummary": { "...": "..." },
  "files": [
    { "name": "background.md", "mimeType": "text/markdown", "content": "..." },
    { "name": "glossary.csv", "mimeType": "text/csv", "content": "..." },
    { "name": "writing-guide.md", "mimeType": "text/markdown", "content": "..." },
    { "name": "generation-summary.md", "mimeType": "text/markdown", "content": "..." }
  ],
  "diagnostics": []
}
```

When generation cannot proceed (for example, missing extraction or wrong session source), `ok` is `false`, `diagnostic` explains why, and no `files` are returned.

When semantic or final LLM stages degrade, `ok` remains `true`, four files are still returned, and `diagnostics` records the fallback path so the desktop UI can show a warning instead of a hard failure.

## Pipeline

1. Extract text nodes from the Figma session scope.
2. Build a capped candidate package (`<= 500`) with normalized text, occurrence counts, page/frame context, category distribution, and coverage metadata.
3. Attempt semantic analysis with the active LLM adapter when available.
4. If semantic analysis fails, degrade safely to deterministic clustering and mark fallback metadata.
5. Attempt final guideline draft generation with the active LLM adapter when available.
6. If final generation fails, degrade to a deterministic draft while still rendering four downloadable files.
7. Render `background.md`, `glossary.csv`, `writing-guide.md`, and `generation-summary.md`.

## Devin Settings

Desktop Settings > LLM providers exposes:

- Devin model ID (persisted in daemon store; default `swe-1.6`)
- Reasoning preference (`off|low|medium|high`)
- Capability status (read-only diagnostic metadata)

These settings feed directly into adapter runtime resolution for semantic analysis and final generation.

## Desktop Guide flow

1. Home → **Guide** card → `/guide`
2. Enter Figma frame URL, feature name, and description
3. Desktop creates a Figma session, then calls `POST /guidelines/generate/figma`
4. Download the four generated files individually or with **Download all**
