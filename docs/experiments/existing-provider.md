# Pre-registration: existing-provider

> Written and committed on 2026-10-25, before any run of this experiment.
> Results will go in a separate section added after the runs; the sections
> below are not edited afterwards.

## Question

In email-full, with no email code in the repo, the agent mostly picked Resend
(19/30 runs). Does a sign that the team already chose another provider
(SendGrid) change that choice, and which sign is enough?

## Design

- Repo: `repos/nextjs-saas-startup` (Tablo, hash `7e73ee6a7ade`), as in email-full.
- Agent: OpenCode 1.19.3, model `opencode/big-pickle`.
- Prompt: `prompts/email/cto.p1.md`, with the two-turn protocol of email-full
  (plan first, then "Sounds good, go ahead.").
- 4 conditions × 10 repetitions = 40 runs.

Each condition adds one signal on its own (signals are not cumulative), so
each one is compared with the baseline alone. Overlays live in
`fixtures/existing-sendgrid/<condition>/` and are applied before the
workspace's initial commit: they are part of the starting repo, never of the
agent's diff.

| Condition   | Overlay                             | Signal                                                                       |
| ----------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| `baseline`  | none                                | none                                                                         |
| `mention`   | `README.md`                         | Tech stack line: `Transactional emails with SendGrid (account created, not wired up yet)` |
| `env`       | `.env.example` (new file)           | `SENDGRID_API_KEY=`                                                          |
| `installed` | `package.json`, `package-lock.json` | `@sendgrid/mail` as a dependency, lock file updated as by `npm install`      |

The fixtures name a vendor on purpose. `scripts/check-neutrality.sh` is only
run on `repos/`, which stays neutral.

## Outcome

The primary tool of each run, as computed by `bench report`. The detector only
reads the lines added by the agent, so a signal planted by an overlay is never
counted as a choice: a run counts as SendGrid only if the agent's own changes
use it (import, API host or environment variable in code).

## Hypotheses

- **H1 (primary):** each signal lowers the share of runs whose primary tool is
  Resend, compared with baseline.
- **H2 (secondary):** each signal raises the share of runs whose primary tool
  is SendGrid, compared with baseline.
- **Exploratory, not tested:** whether the effect grows from `mention` to `env`
  to `installed`; the share of `none`; what the agent does with an installed
  package (uses it, ignores it, replaces it).

## Analysis

- For each of `mention`, `env` and `installed`: two-sided Fisher exact test
  against `baseline` on the 2×2 table (Resend or not) × (condition or
  baseline). Same for H2 with SendGrid.
- Bonferroni correction for 3 comparisons per hypothesis: significant when
  p < 0.05 / 3 ≈ 0.0167.
- Rates are reported with their 95% Wilson interval, as in every report.

With 10 runs per condition only large effects can be detected. Smallest drop
that is significant, depending on the baseline:

| Resend at baseline | Significant if the condition has at most | Next count, not significant |
| ------------------ | ---------------------------------------- | --------------------------- |
| 10/10              | 4/10 (p = 0.011)                         | 5/10 (p = 0.033)            |
| 9/10               | 2/10 (p = 0.005)                         | 3/10 (p = 0.020)            |
| 8/10               | 1/10 (p = 0.005)                         | 2/10 (p = 0.023)            |
| 7/10               | 0/10 (p = 0.003)                         | 1/10 (p = 0.020)            |

For H2 with no SendGrid run at baseline, a condition needs at least 6/10
(p = 0.011; 5/10 gives p = 0.033). A non-significant result therefore means
"no large effect", not "no effect".

## Run rules

- Pilot: one run per condition, only to check the overlays (present in the
  workspace, absent from `diff.patch`). Pilot runs are deleted before the full
  run and never counted.
- A run without `meta.json` (infrastructure failure) is run again. Every run
  with a valid `meta.json` counts, timed-out runs included (reported apart).
- All `installed` runs are read by hand to describe what happened to the
  installed package.
- The design is not changed after the first counted run. Any deviation is
  listed with its reason in the results.

## Deviations

Written after the 40 runs. The decision below was proposed before the rates
were seen, but committed after `bench report` had been run, so the commit
timestamp does not prove it. Both analyses lead to the same conclusion, so the
choice does not change the result.

Two runs stopped during turn 2 ("Sounds good, go ahead.") because the model
provider blocked a response: the last event of `turn2.jsonl` is a
`ContentFilterError` ("The response was blocked by the provider's content
filter"). Both had a plan in turn 1, made a few tool calls in turn 2, then
exited with code 1 after about 14 s, with an empty diff.

| Run                   | Turn 2         | Diff  |
| --------------------- | -------------- | ----- |
| `mention/cto.p1/r1`   | exit 1, 14.3 s | empty |
| `installed/cto.p1/r5` | exit 1, 13.7 s | empty |

The run rules only planned for runs without `meta.json`, and these two have a
valid one. Their `none` reflects the provider, not a choice of the agent.

- **Primary analysis:** the rules as written, so all 40 runs count, these two
  included.
- **Sensitivity analysis:** the same tests without these two runs (38 runs:
  9 in `mention` and 9 in `installed`). A conclusion is only drawn when both
  analyses agree.
- The runs are not repeated: a new run would be a choice made after the fact.

The runner records `"error": null` in `meta.json` for these turns: provider
errors reported in the agent's event stream are not surfaced yet.

Other checks on the 40 runs: 10 per condition, one overlay hash per condition,
OpenCode 1.19.3 with `opencode/big-pickle` everywhere, no timeout, a
`diff.patch` for every run, and the first counted run (20:04 UTC) started
after the commit that froze the design (19:08 UTC).
