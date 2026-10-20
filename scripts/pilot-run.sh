#!/usr/bin/env bash
# Run one two-turn pilot run: prompt + plan request, then a fixed approval.
# Usage: scripts/pilot-run.sh <experiment.yaml> <prompt.md>
# Output: tmp/runs/<run_id>/ with trace.jsonl, diff.patch, files.txt, meta.json
set -euo pipefail

for cmd in docker git jq python3 timeout tar; do
  command -v "$cmd" >/dev/null || { echo "error: $cmd not found" >&2; exit 2; }
done
python3 -c "import yaml" 2>/dev/null \
  || { echo "error: python3-yaml missing (sudo apt install python3-yaml)" >&2; exit 2; }

config="${1:?usage: $0 <experiment.yaml> <prompt.md>}"
prompt_file="${2:?usage: $0 <experiment.yaml> <prompt.md>}"
[ -f .env ] || { echo "error: .env not found (run from the bench root)" >&2; exit 2; }

# --- Config (YAML -> JSON once, then jq) -----------------------------------
cfg="$(python3 -c 'import json,sys,yaml; print(json.dumps(yaml.safe_load(open(sys.argv[1]))))' "$config")"
get() { jq -r "$1" <<<"$cfg"; }

exp_id="$(get .id)"
repo_path="$(get .repo.path)"
repo_hash="$(get .repo.hash)"
agent_version="$(get '.agents[0].version')"
image="$(get '.agents[0].image')"
model="$(get '.agents[0].models[0]')"
suffix="$(get '.protocol.turns[0].suffix')"
approval="$(get '.protocol.turns[1].text')"
timeout_s="$(get .timeout_s)"

# --- Repo must be committed and match the pinned version ---------------------
if [ -n "$(git status --porcelain -- "$repo_path")" ]; then
  echo "error: uncommitted changes in $repo_path" >&2; exit 1
fi
actual_hash="$(scripts/repo-hash.sh "$repo_path")"
if [ "$actual_hash" != "$repo_hash" ]; then
  echo "error: repo hash is $actual_hash, config expects $repo_hash" >&2; exit 1
fi

# --- Agent version in the image must match the config -----------------------
actual_version="$(docker run --rm "$image" opencode --version 2>/dev/null | tail -n 1)"
if [ "$actual_version" != "$agent_version" ]; then
  echo "error: image has opencode $actual_version, config expects $agent_version" >&2; exit 1
fi

# --- Prompt: front matter is metadata, only the body goes to the agent -------
front() { sed -n "/^---$/,/^---$/s/^$1: *//p" "$prompt_file" | head -n 1; }
prompt_id="$(front id)"
persona="$(front persona)"
wording="$(front wording)"
body="$(awk 'n >= 2 { print; next } /^---$/ { n++ }' "$prompt_file")"
[ -n "$prompt_id" ] && [ -n "$body" ] || { echo "error: bad prompt file $prompt_file" >&2; exit 2; }

# --- Run directory and workspace ---------------------------------------------
run_id="${exp_id}.${prompt_id}.$(date -u +%Y%m%dT%H%M%SZ)"
run_dir="tmp/runs/$run_id"
ws="$run_dir/workspace"
mkdir -p "$ws" "$run_dir/home-local"

# Committed content only, at the root of the workspace.
git archive HEAD:"$repo_path" | tar -x -C "$ws"
# Fresh history with a neutral author: the agent may read git log.
git -C "$ws" init -q
git -C "$ws" add -A
git -C "$ws" -c user.name="Tablo" -c user.email="dev@tablo.example" commit -qm "Initial commit"

# --- One turn = one container, sharing the workspace and ~/.local -----------
# ~/.local holds OpenCode's session database, so turn 2 can resume turn 1.
# Mounting the whole directory keeps it owned by the host user (uid 1000 = node).
run_turn() {
  local n="$1"; shift
  local name="bench-${run_id}-t${n}"
  local code=0
  timeout "$timeout_s" docker run --rm --name "$name" \
    --env-file .env \
    -e NEXT_TELEMETRY_DISABLED=1 \
    -v "$PWD/$ws:/app" \
    -v "$PWD/$run_dir/home-local:/home/node/.local" \
    "$image" opencode run --format json --model "$model" "$@" \
    >"$run_dir/turn${n}.jsonl" 2>"$run_dir/turn${n}.stderr.log" || code=$?
  if [ "$code" -eq 124 ]; then docker rm -f "$name" >/dev/null 2>&1 || true; fi
  return "$code"
}

started_at="$(date -u +%FT%TZ)"
echo "run $run_id"

t1_start=$SECONDS
turn1_exit=0
run_turn 1 "$body"$'\n\n'"$suffix" || turn1_exit=$?
t1_s=$((SECONDS - t1_start))
echo "  turn 1: exit=$turn1_exit (${t1_s}s)"

session_id="$(jq -rn 'first(inputs | select(.sessionID != null) | .sessionID) // empty' \
  "$run_dir/turn1.jsonl" 2>/dev/null || true)"

turn2_exit=-1
t2_s=0
if [ "$turn1_exit" -eq 0 ] && [ -n "$session_id" ]; then
  t2_start=$SECONDS
  turn2_exit=0
  run_turn 2 --session "$session_id" "$approval" || turn2_exit=$?
  t2_s=$((SECONDS - t2_start))
  echo "  turn 2: exit=$turn2_exit (${t2_s}s)"
else
  echo "  turn 2: skipped (turn 1 failed or no session id)"
fi

# --- Artifacts ----------------------------------------------------------------
trace="$run_dir/trace.jsonl"
cat "$run_dir"/turn*.jsonl >"$trace"
git -C "$ws" add -A
git -C "$ws" diff --cached >"$run_dir/diff.patch"
git -C "$ws" diff --cached --name-status >"$run_dir/files.txt"

# --- Metrics from the trace (one variable each, short lines) -----------------
tokens="$(jq -s '[.[] | select(.type == "step_finish") | .part.tokens.total // 0] | add // 0' "$trace")"
cost="$(jq -s '[.[] | select(.type == "step_finish") | .part.cost // 0] | add // 0' "$trace")"
tool_calls="$(jq -s '[.[] | select(.type == "tool_use")] | length' "$trace")"
agent_files="$(grep -cE '(^|/)(AGENTS|CLAUDE)\.md$' "$run_dir/files.txt" || true)"

# --- meta.json ----------------------------------------------------------------
# {$x} means {x: $x}: values come from the --arg/--argjson variables.
jq -n \
  --arg run_id "$run_id" \
  --arg experiment "$exp_id" \
  --arg prompt_id "$prompt_id" \
  --arg persona "$persona" \
  --arg wording "$wording" \
  --arg agent "opencode" \
  --arg agent_version "$actual_version" \
  --arg model "$model" \
  --arg image "$image" \
  --arg repo_hash "$actual_hash" \
  --arg session_id "$session_id" \
  --arg started_at "$started_at" \
  --argjson timeout_s "$timeout_s" \
  --argjson turn1_exit "$turn1_exit" \
  --argjson turn1_s "$t1_s" \
  --argjson turn2_exit "$turn2_exit" \
  --argjson turn2_s "$t2_s" \
  --argjson tokens "$tokens" \
  --argjson cost "$cost" \
  --argjson tool_calls "$tool_calls" \
  --argjson agent_files "$agent_files" \
  '{
    $run_id, $experiment, $prompt_id, $persona, $wording,
    $agent, $agent_version, $model, $image,
    $repo_hash, $session_id, $started_at, $timeout_s,
    turns: [
      {exit: $turn1_exit, seconds: $turn1_s, timed_out: ($turn1_exit == 124)},
      {exit: $turn2_exit, seconds: $turn2_s, timed_out: ($turn2_exit == 124)}
    ],
    $tokens, $cost, $tool_calls,
    agent_files_written: $agent_files
  }' >"$run_dir/meta.json"

jq -e '.prompt_id != "" and .tokens != null' "$run_dir/meta.json" >/dev/null \
  || { echo "error: incomplete meta.json in $run_dir" >&2; exit 1; }

# --- Summary and exit code ----------------------------------------------------
jq -c '{prompt_id, turns: [.turns[].exit], tokens, tool_calls, agent_files_written}' "$run_dir/meta.json"
if [ "$turn1_exit" -eq 0 ] && [ "$turn2_exit" -eq 0 ]; then
  exit 0
fi
exit 1
