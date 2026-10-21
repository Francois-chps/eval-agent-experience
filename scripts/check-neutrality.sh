#!/usr/bin/env bash
# Check that a synthetic repo contains nothing that could steer an agent's tool choice.
# Usage: scripts/check-neutrality.sh <repo-dir>
# Exit codes: 0 = neutral, 1 = problems found, 2 = usage error.
set -euo pipefail

repo_dir="${1:?usage: $0 <repo-dir>}"
if [ ! -d "$repo_dir" ]; then
  echo "error: '$repo_dir' is not a directory" >&2
  exit 2
fi

# Vendors and services an agent could pick for the tasks we will ask.
vendors=(
  # transactional email
  resend sendgrid postmark mailgun mailjet mailchimp mandrill sparkpost brevo sendinblue
  nodemailer react-email client-ses
  # feature flags
  launchdarkly unleash flagsmith growthbook statsig configcat posthog
  # services often suggested for Next.js apps
  vercel supabase firebase prisma drizzle stripe sentry clerk auth0
)

# Words that would reveal the experiment to the agent.
# "cursor" is deliberately absent: it is also a CSS property.
leaks=(benchmark agent agents llm ai claude anthropic openai gemini opencode copilot armature prompt)

# Agent instruction files would add context outside the experiment's control.
agent_files='(^|/)(AGENTS\.md|CLAUDE\.md|GEMINI\.md|\.cursorrules|\.cursor/|\.github/copilot-instructions\.md)'

join() { local IFS='|'; echo "$*"; }
vendor_re="$(join "${vendors[@]}")"
leak_re="$(join "${leaks[@]}")"

# Tracked files + untracked files that are not ignored,
# so the check also works before committing.
mapfile -d '' files < <(git ls-files -z --cached --others --exclude-standard -- "$repo_dir")

sources=()
lockfile=""
for f in "${files[@]}"; do
  [ -f "$f" ] || continue # deleted but not yet committed
  case "$f" in
    package-lock.json|*/package-lock.json) lockfile="$f" ;;
    *) sources+=("$f") ;;
  esac
done

if [ "${#sources[@]}" -eq 0 ]; then
  echo "error: no files found in '$repo_dir' (is it inside this git repo?)" >&2
  exit 2
fi

status=0
report() {
  local label="$1" hits="$2"
  if [ -z "$hits" ]; then
    echo "ok    $label"
  else
    echo "FAIL  $label"
    printf '%s\n' "$hits" | sed 's/^/        /'
    status=1
  fi
}

report "no vendor names in source files" \
  "$(grep -nHwiE "$vendor_re" -- "${sources[@]}" || true)"

report "no words revealing the experiment" \
  "$(grep -nHwiE "$leak_re" -- "${sources[@]}" || true)"

report "no TODO/FIXME/XXX/HACK markers" \
  "$(grep -nHwE 'TODO|FIXME|XXX|HACK' -- "${sources[@]}" || true)"

report "no agent instruction files" \
  "$(printf '%s\n' "${files[@]}" | grep -E "$agent_files" || true)"

if [ -n "$lockfile" ]; then
  report "no vendor packages in $lockfile" \
    "$(grep -nE '^[[:space:]]*"node_modules/' "$lockfile" | grep -iE "$vendor_re" || true)"
fi

exit "$status"
