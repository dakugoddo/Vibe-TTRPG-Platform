#!/usr/bin/env bash
set -euo pipefail

# Repo-local Graphify wrapper. Keeps agent hooks portable instead of hardcoding
# C:\Users\... paths. Fails open so coding tools are not blocked if Graphify
# is temporarily unavailable.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
CMD="${1:-hook-check}"
shift || true

if command -v graphify >/dev/null 2>&1; then
  exec graphify "$CMD" "$@"
fi

UV_PY="$HOME/AppData/Roaming/uv/tools/graphifyy/Scripts/python.exe"
if [ -x "$UV_PY" ]; then
  exec "$UV_PY" -m graphify "$CMD" "$@"
fi

WIN_UV_PY="C:/Users/GOD/AppData/Roaming/uv/tools/graphifyy/Scripts/python.exe"
if [ -x "$WIN_UV_PY" ]; then
  exec "$WIN_UV_PY" -m graphify "$CMD" "$@"
fi

# Fail open: hooks should optimize memory, not break development.
echo "graphify not found; skipping graph hook" >&2
exit 0
