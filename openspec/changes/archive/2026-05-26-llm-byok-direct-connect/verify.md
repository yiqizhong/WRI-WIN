# Verification: llm-byok-direct-connect

## Automated

```bash
npm install
npm run typecheck
npm run test
```

## Manual

1. Start daemon + desktop.
2. Agents → API provider: set Ollama or compatible `baseUrl` / `apiKey` / `model`.
3. **Test stream** succeeds.
4. Switch to **Direct API (BYOK)** → `byok` card shows configured → **Test connection** OK.
5. `POST /agents/runs` with active `byok` streams completion events.

## Security

- Confirm `http://192.168.x.x` base URL is rejected by daemon.
