#!/usr/bin/env bash
# Usage: scripts/smoke-run.sh [model] [prompt]
# Runs one agent session in a fresh container and saves:
#   trace.jsonl (events), diff.patch (changes), meta.json (context), stderr.log (debug)
set -euo pipefail

IMAGE="agent-bench:0.1"
MODEL="${1:-opencode/big-pickle}"
PROMPT="${2:-Create a small Python script hello.py that prints Hello, then run it.}"
TIMEOUT_SEC=600

if [[ ! -f .env ]]; then
  echo "Missing .env (copy .env.example and add your key)" >&2
  exit 1
fi

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-${MODEL//\//_}"
RUN_DIR="tmp/runs/${RUN_ID}"
WS="${RUN_DIR}/workspace"
mkdir -p "$WS"

# Git baseline so we can diff exactly what the agent changed
git -C "$WS" init -q
git -C "$WS" -c user.email=runner@local -c user.name=runner \
  commit -q --allow-empty -m "baseline"

START=$(date +%s)
set +e
timeout "$TIMEOUT_SEC" docker run --rm \
  --env-file .env \
  -v "$PWD/$WS:/app" \
  "$IMAGE" \
  opencode run --model "$MODEL" --format json "$PROMPT" \
  > "${RUN_DIR}/trace.jsonl" 2> "${RUN_DIR}/stderr.log"
EXIT_CODE=$?
set -e
END=$(date +%s)

# Capture all changes, including new untracked files
git -C "$WS" add -A
git -C "$WS" diff --cached > "${RUN_DIR}/diff.patch"

OPENCODE_VERSION=$(docker run --rm "$IMAGE" opencode --version 2>/dev/null || echo unknown)

jq -n \
  --arg run_id "$RUN_ID" \
  --arg model "$MODEL" \
  --arg prompt "$PROMPT" \
  --arg image "$IMAGE" \
  --arg opencode_version "$OPENCODE_VERSION" \
  --argjson exit_code "$EXIT_CODE" \
  --argjson duration_s "$((END - START))" \
  --argjson timeout_s "$TIMEOUT_SEC" \
  '{run_id: $run_id, agent: "opencode", opencode_version: $opencode_version,
    model: $model, image: $image, prompt: $prompt,
    exit_code: $exit_code, timed_out: ($exit_code == 124),
    duration_s: $duration_s, timeout_s: $timeout_s}' \
  > "${RUN_DIR}/meta.json"

echo "Run ${RUN_ID} done (exit ${EXIT_CODE}, $((END - START))s)"
echo "→ ${RUN_DIR}"
