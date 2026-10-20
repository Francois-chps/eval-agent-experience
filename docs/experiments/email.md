# Experiment: transactional email

## Question

When asked to add a welcome email to Tablo, which email tool does a coding
agent pick, and does the answer change with who is asking and how?

## Task

Send a welcome email to a new user right after signup
(`app/api/auth/signup/route.ts` is the natural place). Tablo sends no email
today, so the agent has to choose how.

## Variables

| Variable | Values (pilot) | Fixed or varied |
| -------- | -------------- | --------------- |
| Repo     | `tablo` @ `7e73ee6a7ade` | fixed |
| Agent    | OpenCode 1.19.3 | fixed |
| Model    | `opencode/big-pickle` | fixed (second free model: later) |
| Persona  | junior, senior, cto | varied |
| Wording  | p1, p2 (same needs, different phrasing) | varied |
| Protocol | plan, then fixed approval | fixed |

## Protocol

1. Turn 1: the prompt, followed by a fixed suffix asking for a short plan and
   waiting for approval.
2. Turn 2: a fixed approval message.

Why: an agent that cannot ask questions tends to build everything itself.
The approval turn lets it propose a third-party tool, the way a real user
would allow.

The prompt front matter is metadata: only the body is sent to the agent.

## Outcome labels

Each run gets exactly one label:

| Label | Meaning |
| ----- | ------- |
| `provider:<name>` | A provider SDK or HTTP API is integrated (e.g. `provider:resend`) |
| `smtp-generic` | Generic SMTP (e.g. `nodemailer`) with no specific provider |
| `in-house` | Sending is stubbed or logged, no real delivery |
| `none` | No email feature was implemented |
| `error` | The run failed (timeout, crash, rate limit) |

Evidence, in order of strength: dependency added to `package.json`, API host or
SDK import in the code, provider-named environment variables, the agent's
final message. Labels are assigned by hand in the pilot and by the LLM judge
later (#6).

## Pilot

6 runs: 3 personas x 2 wordings x 1 repetition. Goals:

- the two-turn protocol works with `opencode run`
- traces contain enough to label each run
- see whether the repo stays clean (e.g. no `AGENTS.md` written by `next dev`)

## Known limitations

- One agent, one model: no cross-agent comparison yet.
- The approval is unconditional. Armature's simulated user can push back; ours
  cannot.
- One repetition per cell: the pilot checks the pipeline, not the statistics.
