#!/usr/bin/env bash
# Installs the CUDA 12 runtime DLLs that the bundled llama-cli's CUDA backend
# (ggml-cuda.dll) requires. Without these, ggml-cuda.dll fails to load with
# Windows error 126 (ERROR_MOD_NOT_FOUND) and llama.cpp silently falls back to
# CPU — producing slow/empty output ("Agent returned empty rewrite").
#
# The NVIDIA driver ships nvcuda.dll (the CUDA *driver* API), but NOT the CUDA
# *runtime* libraries (cudart/cublas). Those come from the CUDA Toolkit or its
# redistributable archives. We fetch only the 3 DLLs we need (~150MB on disk)
# from NVIDIA's public redist, avoiding the full ~3GB toolkit install.
#
# Usage:  bash scripts/install-cuda-runtime.sh [target-dir]
#   target-dir defaults to the directory containing llama-cli.exe (~/.writer).
set -euo pipefail

CUDA_VER="12.8"
CUDART_ARCHIVE="cuda_cudart/windows-x86_64/cuda_cudart-windows-x86_64-12.8.90-archive.zip"
CUBLAS_ARCHIVE="libcublas/windows-x86_64/libcublas-windows-x86_64-12.8.4.1-archive.zip"
BASE="https://developer.download.nvidia.com/compute/cuda/redist"
WANT=("cudart64_12.dll" "cublas64_12.dll" "cublasLt64_12.dll")

TARGET="${1:-$USERPROFILE/.writer}"
if [ ! -f "$TARGET/llama-cli.exe" ]; then
  echo "WARNING: llama-cli.exe not found in $TARGET — installing DLLs there anyway." >&2
fi

# Skip if already present.
missing=0
for dll in "${WANT[@]}"; do
  [ -f "$TARGET/$dll" ] || missing=1
done
if [ "$missing" -eq 0 ]; then
  echo "CUDA $CUDA_VER runtime already present in $TARGET — nothing to do."
  exit 0
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Downloading CUDA $CUDA_VER cudart..."
curl -fsSL "$BASE/$CUDART_ARCHIVE" -o "$tmp/cudart.zip"
echo "Downloading CUDA $CUDA_VER cublas (~550MB)..."
curl -fsSL "$BASE/$CUBLAS_ARCHIVE" -o "$tmp/cublas.zip"

echo "Extracting ${WANT[*]} into $TARGET..."
TARGET_WIN="$(cygpath -w "$TARGET" 2>/dev/null || echo "$TARGET")"
powershell.exe -NoProfile -Command "
  Add-Type -Assembly 'System.IO.Compression.FileSystem'
  \$want = @($(printf "'%s'," "${WANT[@]}" | sed 's/,$//'))
  \$dest = '$TARGET_WIN'
  foreach (\$zip in @('$(cygpath -w "$tmp/cudart.zip")','$(cygpath -w "$tmp/cublas.zip")')) {
    \$z = [System.IO.Compression.ZipFile]::OpenRead(\$zip)
    foreach (\$e in \$z.Entries) {
      if (\$want -contains \$e.Name) {
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile(\$e, (Join-Path \$dest \$e.Name), \$true)
        Write-Output ('  ' + \$e.Name)
      }
    }
    \$z.Dispose()
  }
"

echo "Verifying CUDA backend loads..."
if [ -f "$TARGET/llama-cli.exe" ]; then
  if (cd "$TARGET" && ./llama-cli.exe --list-devices 2>/dev/null | grep -qiE "CUDA[0-9]"); then
    echo "OK: CUDA device detected. Local inference will run on the NVIDIA GPU."
  else
    echo "ERROR: CUDA device still not detected after install." >&2
    exit 1
  fi
fi
