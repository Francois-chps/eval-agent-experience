#!/usr/bin/env bash
# Print a short, deterministic content hash of a synthetic repo.
# Same files with the same content => same hash, on any machine, at any date.
# Usage: scripts/repo-hash.sh <repo-dir>
set -euo pipefail

repo_dir="${1:?usage: $0 <repo-dir>}"
cd "$repo_dir"

if [ -n "$(git status --porcelain -- .)" ]; then
  echo "warning: uncommitted changes in '$repo_dir': the hash describes your working copy, not a commit" >&2
fi

git ls-files -z --cached --others --exclude-standard -- . \
  | LC_ALL=C sort -z \
  | xargs -0 sha256sum \
  | sha256sum \
  | cut -c1-12
