# Runner

TypeScript tool that turns an experiment config into runs and checks that
every run happens under the conditions the config declares.

Status: the foundations are in place (config, plan, preflight checks,
workspace, long commands, `meta.json`). Running agents and the `run`
command come in follow-up pull requests.

## Requirements

- Node.js 22 or later, git, bash
- Docker and the agent image (e.g. `agent-bench:0.1`) for preflight checks

## Commands

```bash
npm install
npm run bench -- help
npm run bench -- plan experiments/email-pilot.yaml
```

`plan` prints one run id per line on stdout and a summary
(`N runs, N prompts, N repetition(s)`) on stderr. It also checks that every
prompt file exists and belongs to the experiment's category.

Run ids are stable, so an interrupted experiment can resume:

```
<experiment>/<agent>/<model-slug>/<persona>.<wording>/r<N>
```

Repetitions are the outer loop: all prompts get repetition 1 before any
gets repetition 2.

## Preflight checks

Before any run, these checks must all pass. All of them run and report,
so every problem shows up at once.

| Check | Fails when |
|---|---|
| repo committed | the synthetic repo has uncommitted changes |
| repo hash | `scripts/repo-hash.sh` differs from `repo.hash` in the config |
| neutrality | `scripts/check-neutrality.sh` finds vendor names or revealing words |
| `<agent>` image | the image is not available locally |
| `<agent>` version | the agent inside the image is not the declared version |

## Workspace

Each run gets a fresh copy of the synthetic repo, built like the pilot:

- committed content only (`git archive`), at the root of the workspace;
- a new history with a single commit, `Initial commit`, by
  `Tablo <dev@tablo.example>`;
- on branch `master`, matching the pilot (its `git init` used Git's
  default branch). Agents can see the branch name, so it is a fixed
  condition.

## Long commands

Agent turns run with `runLongCommand`: stdout and stderr go straight to
files (`turnN.jsonl`, `turnN.stderr.log`), so nothing is held in memory and
partial output survives a timeout. At the timeout the command gets SIGTERM,
then SIGKILL after a 5-second grace period.

## meta.json

One file per finished run. It is validated before being written, so an
incomplete `meta.json` never reaches the disk. A run counts as finished
only when its `meta.json` is valid.

Field names match `scripts/pilot-run.sh`, so the same `jq` queries work on
pilot runs and runner runs. Differences:

| Field | Pilot | Runner |
|---|---|---|
| `run_id` | `<exp>.<prompt>.<timestamp>` | stable run id (see above) |
| `repetition`, `workspace_branch` | absent | present |
| timed-out turn | `exit: 124` | `exit: null, timed_out: true` |
| skipped turn | `exit: -1` | `exit: null, skipped: true` |
| `turns[].error` | absent | why the turn could not start, or `null` |
| `turns[].seconds` | whole seconds | milliseconds precision |

## Tests

```bash
npm test           # unit, then integration (needs git and bash, not Docker)
npm run typecheck
```
