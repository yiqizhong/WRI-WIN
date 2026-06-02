<!--
Raw capture of superpowers:brainstorming output.
Design was approved prior to OpenSpec change creation; this is the decision log.
-->

## Background

Writer bundles a single local Gemma 4 E4B quantization: `Q8_0` (~8.6 GB). The CUDA build only enumerates NVIDIA GPUs. A user with a sub-12 GB NVIDIA card (e.g. 8 GB RTX 3070) downloads the full model and then gets a hard CUDA out-of-memory failure at load time — they pay the entire download cost for something that can never run.

## Decision Chain

**Q1: Should we support multiple quants or pick one at build time?**

Pick at runtime per-device. A build-time decision would require separate installers. Runtime selection costs one extra manifest constant and a resolver function. → **Runtime selection.**

**Q2: What's the selection threshold?**

The nominal boundary is 12 GB. But real GPUs report slightly under their label (e.g. a 12 GB card may report 12000 MiB, not 12288 MiB). Using 12288 MiB as the threshold would misclassify a real 12 GB card and serve it `Q4_K_M`. → **Threshold: 12000 MiB** (not 12288).

**Q3: Which quants?**

- `Q8_0` (~8.6 GB): no quality loss, fits comfortably in 12 GB with KV cache headroom.
- `Q4_K_M` (~5.34 GB): fits in 8 GB with room for KV cache. Confirmed from `ggml-org/gemma-4-E4B-it-GGUF` (sha256: `90ce98129eb3e8cc57e62433d500c97c624b1e3af1fcc85dd3b55ad7e0313e9f`, 5,335,289,824 bytes).
- No smaller quant needed for v1 (below 8 GB → blocked, not degraded further).

**Q4: What about cards below 8 GB, or non-NVIDIA hardware?**

Block the download entirely with a clear message. The CUDA-only llama.cpp build can't run on AMD/Intel/integrated GPUs anyway. Guessing high (serving a large quant that can't run) is worse than blocking. → **Fail safe: null VRAM → blocked.**

**Q5: Where does detection live?**

`packages/agent-adapters/src/adapters/local-gemma-adapter.ts` already runs `llama-cli --list-devices` and parses the output. Extending `listGpuDevices` to also extract total MiB keeps the probe in one place and reuses the existing spawn path. Result is cached for the daemon session. → **Extend `listGpuDevices`, export `detectNvidiaVram()`.**

**Q6: Where does the selection rule live?**

Pure function, no I/O. Best placed near the manifest constants (`local-model-manifest.ts` or a sibling file). Takes `vram: number | null` → `{ manifest } | { blocked, reason }`. → **`resolveLocalModelManifest()` pure function alongside the manifest constants.**

**Q7: What UI changes are needed?**

- The Download tile currently shows the hardcoded Q8_0 size. It should show the *selected* quant's size (so an 8 GB user sees ~5.3 GB).
- In the blocked state, replace the Download button with a short inline message ("No compatible NVIDIA GPU detected").

**Q8: Migration / existing installs?**

Out of scope for v1 (YAGNI). Users who already downloaded Q8_0 on a 12 GB+ card keep their existing file. Sub-12 GB users who already downloaded Q8_0 would need to manually delete — not handled here.

## Design Trade-offs

| Option | Pros | Cons | Decision |
|---|---|---|---|
| Single quant forever | No code change | Sub-12 GB users always fail | ✗ |
| User picks quant manually | Flexible | UX burden; users don't know quant sizes | ✗ |
| Auto-select at download time | Transparent; zero UX friction | One extra manifest + resolver | ✓ |
| Partial CPU/GPU offload for tiny cards | More users supported | Complex; requires NGL tuning | ✗ (YAGNI) |

## Outcome

Selection rule:
- `>= 12000 MiB` → `Q8_0`
- `< 12000 MiB` → `Q4_K_M`
- `null` → `blocked`

4 implementation components: manifests, VRAM detection, resolver, UI update.
