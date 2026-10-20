#!/usr/bin/env bash
# Summarize pilot runs: one block per valid run. Read-only.
# Usage: scripts/pilot-summary.sh [runs-dir] [experiment-id]
set -euo pipefail

runs_dir=${1:-tmp/runs}
exp=${2:-email-pilot}

added() { # lines added by the agent, without file headers or the lockfile
  awk '/^diff --git/ { lock = ($NF ~ /package-lock\.json$/) }
       !lock && /^\+/ && !/^\+\+\+ /' "$1/diff.patch"
}

for dir in "$runs_dir/$exp".*/; do
  dir=${dir%/}
  meta=$dir/meta.json
  [[ -f $meta ]] || { echo "!! $dir: no meta.json"; continue; }
  if ! jq -e '.run_id != null' "$meta" >/dev/null; then
    echo "!! $dir: invalid meta.json, skipped"; echo; continue
  fi

  jq -r '"### \(.prompt_id)  (\(.run_id))",
    "turns:  \(.turns | map("\(.seconds)s exit=\(.exit)\(if .timed_out then " TIMEOUT" else "" end)") | join(" / "))",
    "tokens: \(.tokens)  tool_calls: \(.tool_calls)  agent_files: \(.agent_files_written)"' "$meta"

  echo "turn1 tools: $(jq -r '.. | objects | .tool? | strings' "$dir/turn1.jsonl" 2>/dev/null \
    | sort | uniq -c | awk '{printf "%s×%s ", $2, $1}')"

  echo "files:"
  sed 's/^/  /' "$dir/files.txt" 2>/dev/null || echo "  (none)"

  echo "package.json additions:"
  awk '/^diff --git/ { pj = ($NF ~ /package\.json$/) }
       pj && /^\+[[:space:]]+"[^"]+": "/ { sub(/^\+[[:space:]]+/, "  "); print }' "$dir/diff.patch"

  echo "imports: $(added "$dir" | grep -oE "from ['\"][^.'\"][^'\"]*['\"]" | sort -u | tr '\n' ' ')"
  echo "hosts:   $(added "$dir" | grep -oE 'https?://[A-Za-z0-9.-]+' | sort -u | tr '\n' ' ')"
  echo "env:     $(added "$dir" | grep -oE '\b[A-Z][A-Z0-9_]*(API_KEY|TOKEN|SECRET|FROM|HOST|PORT|USER|PASS|PASSWORD)\b' | sort -u | tr '\n' ' ')"
  echo
done
