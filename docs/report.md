# Reporting an experiment

`bench report` applies the detector ([detection.md](detection.md)) to every finished run of an experiment:

    npm run bench -- report experiments/email-full.yaml

Runs come from the plan, so only the runs the config describes are read. A run is reported when its `meta.json` is valid; an invalid `meta.json` is listed as skipped and never counted; a missing one means the run has not happened yet. The command exits 1 when no run is finished.

It writes `results.csv` and `results.json` (same rows, plus the evidence) to `tmp/runs/<experiment id>/`, and prints the number of runs per primary tool.

## Columns

| Column | Meaning |
|---|---|
| `run_id`, `persona`, `wording`, `model`, `repetition` | Run conditions, from `meta.json` |
| `timed_out` | At least one turn hit the timeout: the change may be unfinished |
| `has_diff` | `false` when the run has no `diff.patch` |
| `verdict` | `single`, `multiple` or `none` |
| `tools` | Every detected tool, in catalog order |
| `primary_tool` | The tool the run relies on, `ambiguous` or `none` |

Timed-out runs are kept: the analysis decides whether to exclude them.

## Primary tool

Each tool is scored by its **strongest** evidence: `dependency` or `import` (3) > `host` (2) > `env` (1). The amount of evidence does not count, so five env vars do not beat one API call. The tool with the highest score wins; a tie gives `ambiguous` rather than an arbitrary pick.
