# Reporting an experiment

`bench report` applies the detector ([detection.md](detection.md)) to every finished run of an experiment:

    npm run bench -- report experiments/email-full.yaml

Runs come from the plan, so only the runs the config describes are read. A run is reported when its `meta.json` is valid; an invalid `meta.json` is listed as skipped and never counted; a missing one means the run has not happened yet. The command exits 1 when no run is finished.

It writes `results.csv` and `results.json` (same rows, plus the evidence) to `tmp/runs/<experiment id>/`, and prints the number of runs per primary tool.

## Columns

| Column | Meaning |
|---|---|
| `run_id`, `persona`, `wording`, `model`, `repetition` | Run conditions, from `meta.json` |
| `condition` | Condition of the run, from the plan: `baseline` when the experiment declares no `conditions` |
| `timed_out` | At least one turn hit the timeout: the change may be unfinished |
| `has_diff` | `false` when the run has no `diff.patch` |
| `verdict` | `single`, `multiple` or `none` |
| `tools` | Every detected tool, in catalog order |
| `primary_tool` | The tool the run relies on, `ambiguous` or `none` |

Timed-out runs are kept: the analysis decides whether to exclude them.

## Primary tool

Each tool is scored by its **strongest** evidence: `dependency` or `import` (3) > `host` (2) > `env` (1). The amount of evidence does not count, so five env vars do not beat one API call. The tool with the highest score wins; a tie gives `ambiguous` rather than an arbitrary pick.

## summary.csv

`bench report` also writes `tmp/runs/<experiment>/summary.csv`: one row per
dimension, group and primary tool.

| Column | Meaning |
|---|---|
| `dimension` | `all`, `condition`, `persona`, `wording` or `model` |
| `group` | value of the dimension, e.g. `cto`; `all` for the whole experiment |
| `tool` | primary tool (`ambiguous` and `none` included) |
| `count` / `total` | runs of the group with this primary tool / runs in the group |
| `rate` | `count / total` |
| `lower` / `upper` | bounds of the 95% Wilson interval |
| `timed_out` | runs of the group where a turn hit the timeout |

Every tool seen in the experiment is listed in every group, even at 0, so
groups can be compared line by line: `0/10` with an upper bound of 27.8% is a
result too. Values are rounded to 4 decimals; `results.json` keeps raw values.
Timed-out runs are counted, since the agent had already made a choice, but
they are shown per group so the reader can judge their weight.
The `condition` dimension only appears when the runs cover more than one
condition, so experiments without `conditions` keep the same summary and page.
Its groups follow the config order (e.g. baseline first, then the variants),
not the alphabetical order; the terminal output also prints the rates of each
condition.


## Confidence intervals

### What the interval says

The rate observed on a few runs is an estimate of how often the agent would
pick the tool over many runs. The 95% interval is the range of values
compatible with what was observed. Samples here are small: in `email-full`,
each persona has 10 runs and each wording 15. With 10 runs, 6/10 gives about
[31%, 83%]: the data say "often", not "60%".

### Why Wilson

The textbook (Wald) interval, `p +/- 1.96 * sqrt(p(1-p)/n)`, breaks down on
small samples and on rates near 0 or 1, which are exactly the cases here:
0/5 gives [0%, 0%] and 1/5 gives [-15%, 55%]. The Wilson score interval stays
inside [0, 1] and keeps a coverage close to 95% even with a handful of runs:
0/5 gives [0%, 43.4%].

```
p      = k / n
center = (p + z^2 / (2n)) / (1 + z^2 / n)
half   = z / (1 + z^2 / n) * sqrt(p (1 - p) / n + z^2 / (4 n^2))
bounds = [center - half, center + half]     z = 1.96 for 95%
```

The bounds are exactly 0 when `k = 0` and exactly 1 when `k = n`, so
floating-point noise never excludes the observed rate.

### Reading overlapping intervals

- **No overlap**: strong sign of a real difference between the two groups.
- **Overlap**: not proof of no difference. 15/30 [33.2%, 66.8%] and 5/30
  [7.3%, 33.6%] overlap, yet a two-proportion test finds a significant
  difference (p < 0.01). Comparing intervals by eye is conservative.
- **Wide intervals everywhere**: the experiment needs more repetitions.
- Intervals are computed tool by tool: with many groups, about 1 in 20 misses
  the true rate by chance, so an isolated surprising group is a lead, not a
  finding. They also cover sampling noise only, not detector errors.
