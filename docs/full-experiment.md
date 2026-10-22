# Full email tool experiment

The pilot (`experiments/email-pilot.yaml`) validated the setup. This experiment reuses it unchanged except for three values, so the two runs are directly comparable.

| Field | Pilot | Full | Why |
|---|---|---|---|
| `id` | `email-pilot` | `email-full` | Results go to `tmp/runs/email-full/`, separate from the pilot. |
| `timeout_s` | 1200 | 1800 | A single turn took ~7 min in the end-to-end test; slow but valid runs should not count as timeouts. |
| `repetitions` | 1 | 5 | Enough runs per condition to report choice rates with confidence intervals. |

The pilot config is never edited: it documents what was actually run.

## Size and duration

Print the exact plan (number of runs = personas × wordings × models × repetitions):

    npm run bench -- plan experiments/email-full.yaml

The current config gives 3 personas × 2 wordings × 1 model (`opencode/big-pickle`) × 5 repetitions = **30 runs**, about 4 hours.

Runs are sequential. The end-to-end test took ~8 minutes per run (two turns), so expect roughly `runs × 8 min`, plus timeouts.

Free OpenCode Zen models are promotional and can be withdrawn. Before launching, check that every model in the config is still listed by `https://opencode.ai/zen/v1/models`.

## Launch

Launch from an up-to-date `main`, so every run is tied to merged code. Use `tmux` so the run survives closing the terminal:

    tmux new -s bench
    npm run bench -- run experiments/email-full.yaml 2>&1 | tee -a tmp/email-full.log

Detach with `Ctrl+B` then `D`. Reattach with `tmux attach -t bench`.

Keep Docker Desktop running and prevent Windows from sleeping: WSL stops when the machine sleeps.

## Monitor

    tail -f tmp/email-full.log
    find tmp/runs/email-full -name meta.json | wc -l

The second command counts finished runs: `meta.json` is only written when a run completes.

## Resume

Run the same command again. Finished runs are skipped (`N run(s) done, M already finished`). Runs interrupted by a Docker failure or Ctrl+C were not recorded, so they are retried.

If the config changed since a run was recorded (for example `timeout_s`), the runner refuses to mix conditions and exits with `was recorded under other conditions`. Restore the config, or use a new `id`.
