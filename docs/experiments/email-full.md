# Findings: email-full

Which email provider does a coding agent pick when asked to send a welcome
email, and does the way the request is phrased change that choice?

- Raw results: [results/email-full.md](../../results/email-full.md)
- Protocol: [docs/full-experiment.md](../full-experiment.md)
- Config: [experiments/email-full.yaml](../../experiments/email-full.yaml)

## Setup

- Agent: OpenCode with `opencode/big-pickle` (free Zen model).
- Task: send a welcome email when a user signs up, in a small Next.js app.
  The prompts never name a provider.
- 3 personas (`cto`, `senior`, `junior`) x 2 wordings x 5 repetitions:
  30 runs, all finished, none timed out.
- Each run gets one primary tool, detected from its diff (dependencies,
  imports, API hosts, environment variables). See
  [docs/detection.md](../detection.md) and [docs/report.md](../report.md).

## Main result

Resend is the agent's default: **19/30 runs, 63% [46-78%]**. Plain SMTP
(Nodemailer) comes far behind with 3/30. No other provider was ever the
primary choice. The remaining 8 runs (27% [14-44%]) chose no provider at
all.

## Persona changes how much the agent commits

| Persona | resend | none | smtp |
|---|---|---|---|
| cto | 10/10 (72-100%) | 0/10 | 0/10 |
| senior | 5/10 (24-76%) | 2/10 | 3/10 |
| junior | 4/10 (17-69%) | 6/10 (31-83%) | 0/10 |

- **cto vs junior**: the Resend intervals do not overlap. Fisher's exact
  test gives p = 0.011, which holds after a Bonferroni correction for the
  three pairwise comparisons (threshold 0.017).
- **cto vs senior**: p = 0.033, below 0.05 but not after correction. A lead,
  not a finding.
- SMTP only appears with the senior persona (3/10), too few runs to
  conclude.

These comparisons were not planned before the runs: treat them as
exploratory until a second experiment confirms them.

## What "none" means

All 8 `none` diffs were read by hand. None of them uses a provider the
detector missed; they all deliberately avoid picking one:

| Pattern | Runs | Persona |
|---|---|---|
| Stub: the email is built but not actually sent | 4 | junior |
| Generic HTTP sender configured by environment variables | 2 | junior |
| Provider abstraction with mock, console or HTTP transports | 2 | senior |

Read together with the table above, the persona seems to set how far the
agent goes: framed by a CTO, it commits to a vendor; framed by a junior, it
leaves the choice open; framed by a senior, it builds an abstraction or
falls back to SMTP.

## Wording has no measurable effect

Resend is chosen in 11/15 runs (48-89%) with the first wording and 8/15
(30-75%) with the second. The intervals overlap widely on every tool.

## Web access

The agent never looked anything up online. Over the 30 runs it made 643
tool calls (bash 356, write 103, edit 92, read 73, other 19) and none of
them used `webfetch` or `websearch`, although both tools were available.

Its shell commands reached the network in only two ways, neither about
email: `npm view tsx version` in 1 run, to check the version of a
TypeScript runner, and `curl` requests to the app it was building on
`localhost:3000` in 3 runs, to test the signup route. No command fetched a
provider's documentation or package metadata.

Counted from the `"tool"` field of every turn log; the total matches the
`tool_calls` recorded in `meta.json`. The 2 runs that started subagents
(`task`) were also checked in OpenCode's session database, which stores
subagent sessions: no web tool call there either.

So with this model, the provider choice comes from what the model learned
in training, not from documentation read during the session: a vendor's
live docs never had a chance to weigh in. Armature reports web searches in
94% of Codex sessions and about 30% of Claude Code sessions; those are
other agents and models, so the figures are not directly comparable, but
they show that how much an agent reads online varies widely.

## Limits

- **One model, one agent.** A free model through OpenCode; other models or
  agents may have very different defaults.
- **One task, one codebase.** A Next.js signup flow may favour providers
  popular in that ecosystem.
- **Small samples.** 10 runs per persona: intervals are wide, and only
  large effects can be detected.
- **Detection reads the diff, not the behaviour.** It records which provider
  the code targets, not whether the email would actually be sent.

