#!/usr/bin/env bash
# Copies the mobile playtest drag fix into a local commanderhelper checkout.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-../commanderhelper/mtg/src/components}"

if [[ ! -d "$TARGET" ]]; then
  echo "Target directory not found: $TARGET"
  echo "Usage: $0 [path/to/commanderhelper/mtg/src/components]"
  exit 1
fi

cp "$ROOT/mtg/src/components/playtest-pointer-drag.ts" "$TARGET/"
cp "$ROOT/mtg/src/components/PlaytestBoard.tsx" "$TARGET/"

echo "Copied playtest mobile drag fix to $TARGET"
echo "Commit in commanderhelper, then deploy."
