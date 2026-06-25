#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Cheap incremental update for code changes. For semantic doc/image changes,
# Graphify may set needs_update; run a full extract/update when prompted.
if command -v graphify >/dev/null 2>&1; then
  graphify update . || graphify check-update . || true
else
  bash scripts/graphify-hook.sh update . || bash scripts/graphify-hook.sh check-update . || true
fi

if [ -f graphify-out/graph.json ]; then
  graphify benchmark graphify-out/graph.json 2>/dev/null || true
fi
