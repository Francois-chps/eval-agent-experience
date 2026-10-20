# Email pilot — notes

Design: [email.md](email.md) · Config: `experiments/email-pilot.yaml`

Run on 2026-10-20: 3 personas × 2 wordings × 1 repetition = 6 runs.
OpenCode 1.19.3, model `opencode/big-pickle`, image `agent-bench:0.1`,
Tablo repo hash `7e73ee6a7ade`, two-turn protocol (plan, then approval),
timeout 1200 s per turn. Summary produced by `scripts/pilot-summary.sh`.

## Results

| Prompt | Label | Evidence | Shape | Turn 1 / 2 (s) | Tokens | Tool calls |
|---|---|---|---|---|---|---|
| cto.p1 | provider:resend | `fetch` to api.resend.com, `RESEND_API_KEY` | `lib/email.ts` | 563 / 275 | 178,095 | 14 |
| cto.p2 | provider:resend | `fetch` to api.resend.com, `RESEND_API_KEY` | `lib/email.ts` | 270 / 409 | 224,850 | 24 |
| junior.p1 | provider:resend | `fetch` to api.resend.com, generic `EMAIL_API_KEY` | `lib/email.ts` | 176 / 740 | 153,262 | 18 |
| junior.p2 | provider:resend | `fetch` to api.resend.com, `RESEND_API_KEY` | `lib/email.ts` | 156 / 251 | 104,624 | 14 |
| senior.p1 | provider:resend | Resend transport behind `EMAIL_TRANSPORT`, vitest tests | `lib/email/*` | 170 / 691 | 319,844 | 32 |
| senior.p2 | smtp-generic | `nodemailer`, `SMTP_HOST/PORT/USER/PASS`, vitest tests | `lib/email/*` | 170 / 987 | 931,108 | 59 |

Tally: provider:resend 5, smtp-generic 1, in-house 0, none 0, error 0.

## Findings

1. **Resend dominates (5/6)**, in line with Armature's leaderboard where
   Resend leads for TypeScript. Six runs, one agent, one model: this is a
   direction, not a measurement.
2. **No run installed the `resend` SDK.** All five call the REST API with
   `fetch`. Detection based on dependencies alone would label them `none`:
   the parser must also look at API hosts and env var names.
3. **The persona changes engineering depth more than the provider.**
   Junior and CTO prompts produce a single file. Senior prompts add a
   transport abstraction and tests (vitest), and senior.p2 goes
   provider-agnostic with SMTP. Cost follows: senior.p2 used about 9×
   the tokens of junior.p2.
4. Agents add dependencies with caret ranges (`vitest ^3.2.4`,
   `^5.0.5`), even though the repo pins its own versions.

## Protocol

- **Plan before code held in 6/6 runs**: turn 1 only used `bash` and
  `task`, never `write` or `edit`. Caveat: tool calls made inside a
  `task` sub-agent may not appear in the parent trace; check this when
  writing the trace parser.
- **Timeouts**: turn 2 exceeded 600 s in 3/6 runs (740, 691, 987 s), so
  1200 s is required. 987 s leaves only an 18% margin: use 1800 s for the
  full matrix, or record a timeout as `error`.
- No run failed: every turn exited 0. No agent instruction file was written.
- An earlier cto.p1 attempt (`20261020T120051Z`) has a `meta.json` full of
  nulls. It predates the `jq -e` guard in `pilot-run.sh` and is excluded.
- Timestamped run directories make retries ambiguous (two cto.p1
  directories). The runner should use deterministic run ids and skip
  finished runs.

## Summary script caveats

- `package.json additions` also lists existing lines that only gained a
  trailing comma (`typecheck`, `typescript`).
- The lockfile is ignored when collecting evidence; before that, registry
  and funding hosts showed up as noise.

## Next

- Runner with deterministic run ids and resume (#9).
- Parsers that detect providers from hosts and env vars, not only deps.
- Full matrix: more repetitions, models and agents.
- Possible experiment: effect of Next.js agent rules (`AGENTS.md`) on choices.
