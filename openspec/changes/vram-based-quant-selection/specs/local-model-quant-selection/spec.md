## ADDED Requirements

### Requirement: Q4_K_M manifest constant defined alongside Q8_0

The local model manifest module SHALL export a second manifest constant for the `Q4_K_M` quantization of Gemma 4 E4B, sharing the same `modelId` and `displayName` as the existing `Q8_0` manifest, differing only in `fileName`, `downloadUrl`, `expectedSha256`, and `fileSizeBytes`.

#### Scenario: Q4_K_M manifest has correct confirmed values

- **WHEN** the Q4_K_M manifest constant is read
- **THEN** its `fileName` is `gemma-4-E4B-it-Q4_K_M.gguf`
- **AND** its `fileSizeBytes` is `5335289824`
- **AND** its `expectedSha256` is `90ce98129eb3e8cc57e62433d500c97c624b1e3af1fcc85dd3b55ad7e0313e9f`

#### Scenario: Both manifests share model identity

- **WHEN** the Q8_0 and Q4_K_M manifest constants are compared
- **THEN** they have the same `modelId` and `displayName`

---

### Requirement: VRAM-based manifest resolver is a pure function

The manifest module SHALL export a pure function `resolveLocalModelManifest(vram: number | null)` that maps detected NVIDIA total VRAM to either a resolved manifest or a blocked outcome, with no I/O.

#### Scenario: 12 GB+ card resolves to Q8_0

- **WHEN** `resolveLocalModelManifest` is called with `vram >= 12000`
- **THEN** it returns `{ manifest: Q8_0_MANIFEST }`

#### Scenario: Sub-12 GB card resolves to Q4_K_M

- **WHEN** `resolveLocalModelManifest` is called with `vram < 12000` and `vram !== null`
- **THEN** it returns `{ manifest: Q4KM_MANIFEST }`

#### Scenario: Null VRAM resolves to blocked

- **WHEN** `resolveLocalModelManifest` is called with `null`
- **THEN** it returns `{ blocked: true, reason: "No compatible NVIDIA GPU detected" }`

#### Scenario: Boundary value 12000 MiB selects Q8_0

- **WHEN** `resolveLocalModelManifest` is called with exactly `12000`
- **THEN** it returns `{ manifest: Q8_0_MANIFEST }`

#### Scenario: Boundary value 11999 MiB selects Q4_K_M

- **WHEN** `resolveLocalModelManifest` is called with `11999`
- **THEN** it returns `{ manifest: Q4KM_MANIFEST }`

---

### Requirement: Daemon model status reflects resolved manifest or blocked state

The daemon's `getLocalModelStatus` function SHALL resolve the manifest via `resolveLocalModelManifest(await detectNvidiaVram())` and SHALL return either the resolved manifest's metadata (including its actual file size) or a blocked indicator with a human-readable reason.

#### Scenario: 12 GB+ GPU returns Q8_0 metadata

- **WHEN** `getLocalModelStatus` is called on a machine with a 12 GB+ NVIDIA GPU
- **THEN** the status response includes the Q8_0 manifest's `fileName` and `fileSizeBytes`

#### Scenario: Sub-12 GB GPU returns Q4_K_M metadata

- **WHEN** `getLocalModelStatus` is called on a machine with an 8 GB NVIDIA GPU
- **THEN** the status response includes the Q4_K_M manifest's `fileName` and `fileSizeBytes`

#### Scenario: No NVIDIA GPU returns blocked status

- **WHEN** `getLocalModelStatus` is called on a machine with no detectable NVIDIA GPU
- **THEN** the status response includes a blocked indicator and a reason string

---

### Requirement: Model download uses resolved manifest; blocked state prevents download

The daemon's `startModelDownload` function SHALL download the file specified by the resolved manifest and verify it against that manifest's `expectedSha256`. It SHALL refuse to start a download when the resolver returns a blocked outcome.

#### Scenario: Download uses resolved quant file

- **WHEN** `startModelDownload` is called on a 12 GB+ machine
- **THEN** it fetches `gemma-4-E4B-it-Q8_0.gguf` and verifies its SHA256

#### Scenario: Download uses Q4_K_M on sub-12 GB machine

- **WHEN** `startModelDownload` is called on an 8 GB machine
- **THEN** it fetches `gemma-4-E4B-it-Q4_K_M.gguf` and verifies its SHA256

#### Scenario: Download blocked when no NVIDIA GPU detected

- **WHEN** `startModelDownload` is called on a machine with no detectable NVIDIA GPU
- **THEN** it rejects with a clear error message without initiating any network request

---

### Requirement: Local LLM UI tile shows selected quant size and blocked state

The desktop Local LLM tile SHALL display the resolved manifest's actual file size rather than a hardcoded value. In the blocked state it SHALL replace the Download button with a short inline message.

#### Scenario: 12 GB+ machine shows Q8_0 size

- **WHEN** the Local LLM tile renders on a machine with a 12 GB+ NVIDIA GPU and the model is not installed
- **THEN** the download size shown is approximately 8.6 GB (Q8_0)

#### Scenario: Sub-12 GB machine shows Q4_K_M size

- **WHEN** the Local LLM tile renders on a machine with an 8 GB NVIDIA GPU and the model is not installed
- **THEN** the download size shown is approximately 5.3 GB (Q4_K_M)

#### Scenario: Blocked state replaces Download button

- **WHEN** the Local LLM tile renders on a machine with no detectable NVIDIA GPU
- **THEN** the Download button is absent
- **AND** an inline message "No compatible NVIDIA GPU detected" is shown in its place
