# Synthetic repos

Synthetic repos are the codebases the agents work in. Each one is a small but
realistic app, written by hand, that must not steer the agent toward any tool.
This file is the registry of those repos and the rules for keeping them
comparable across runs.

The agent only ever sees the content of the repo directory: `smoke-run.sh`
copies it into a fresh workspace with a new git history. Nothing in this file,
in the bench README or in the bench commit history reaches the agent.

## Registry

| Id      | Path                         | Stack                         | Content hash   | Status |
| ------- | ---------------------------- | ----------------------------- | -------------- | ------ |
| `tablo` | `repos/nextjs-saas-startup/` | Next.js (App Router), TS, CSS | `7e73ee6a7ade` | active |

The content hash is produced by `scripts/repo-hash.sh <path>`. Every run must
record it, so results can always be traced back to an exact version of the repo.

## Tablo

**Fictional company.** Tablo is a team scheduling SaaS for independent
restaurants. Seed-stage startup, 7 people, based in Lyon, about 180 restaurants
in France and Belgium. This context is what the prompt personas (issue #3)
build on.

**What exists.**

- Signup, login and logout (`app/api/auth/*`), plain HTML forms posting to
  route handlers that redirect with `303`.
- Cookie sessions (`tablo_session`, httpOnly) stored server-side.
- Password hashing with `scrypt` from `node:crypto`.
- In-memory store in `lib/db.ts`, seeded with one restaurant (Le Comptoir,
  Lyon) and a demo account: `demo@tablo.example` / `demo1234`.
- An authenticated dashboard (server component).

**What deliberately does not exist.** No email sending, no feature flags, no
database, no analytics, no external service of any kind. Those are the slots
the tasks will ask the agent to fill.

## Health check

A repo is healthy when it installs from its lockfile, type-checks and builds
inside the agent image, from a clean copy:

```bash
rm -rf tmp/build-check
cp -r repos/nextjs-saas-startup tmp/build-check
rm -rf tmp/build-check/node_modules tmp/build-check/.next
docker run --rm -v "$PWD/tmp/build-check:/app" -e NEXT_TELEMETRY_DISABLED=1 \
  agent-bench:0.1 sh -c "npm ci && npm run build && npm run typecheck"
```

`build` runs before `typecheck` because `next build` generates `next-env.d.ts`,
which is git-ignored.

## Neutrality checklist

Automated, must exit 0:

```bash
scripts/check-neutrality.sh repos/nextjs-saas-startup
```

It flags vendor names, words revealing the experiment (benchmark, agent, AI...),
TODO/FIXME/XXX/HACK markers, agent instruction files (`AGENTS.md`,
`CLAUDE.md`...) and vendor packages in the lockfile.

Manual, on every change to the repo:

- [ ] The README only describes what exists: no roadmap, no "we plan to use X".
- [ ] No dependency beyond Next, React and the TypeScript toolchain.
- [ ] No `.env` files, no config hinting at a provider.
- [ ] No comment or naming that hints at the upcoming task.
- [ ] The health check passes.

## Known context variables

Things the agent sees that may influence its choices. They are fixed for all
runs; changing one of them means a new repo version.

| Variable               | Value                                                        | Why it matters |
| ---------------------- | ------------------------------------------------------------ | -------------- |
| Framework              | Next.js `16.4.2`, App Router                                 | Framework ecosystems come with "default" vendors |
| UI library             | React `19.3.1`                                               | Installed with Next, no extra UI dependency |
| Language               | TypeScript `6.0.3`, strict                                   | TypeScript 7 is pinned out: `next build` relies on the JS compiler API it no longer ships |
| Runtime                | Node 22 (image `node:22-bookworm`), `@types/node` `26.6.5`   | Same Node major locally and in the agent image; the types are newer than the runtime |
| Styling                | Plain CSS, no framework                                      | A UI library would already be a tool choice |
| Data layer             | In-memory store behind `lib/db.ts`                           | No ORM or database suggested |
| Auth                   | Hand-written, no auth library                                | Same reason |
| Lint                   | None                                                         | No ESLint config that could imply conventions |
| Repo docs              | `README.md` (stack, scripts, structure)                      | Usually the first file the agent reads |
| Next.js agent behavior | Default (`agentRules` not set; `next.config.mjs` only sets `reactStrictMode: true`) | Recent Next versions can write an `AGENTS.md` block when `next dev` is started by a detected coding agent. If it happens, it shows up in `diff.patch` and is flagged by the neutrality check. To watch in the pilot run (#3) |
| Telemetry              | `NEXT_TELEMETRY_DISABLED=1` in checks                        | Keeps checks offline and quiet |

The repo was written by hand rather than generated with `create-next-app`, so
that every file is known and nothing comes from a template's defaults.

## Versioning

- A change to any file under the repo directory changes its content hash.
- Never modify a repo while an experiment matrix is running: results from two
  versions are not comparable.
- After a change: run the health check and the neutrality check, update the
  hash in the registry, and mention the reason in the commit message.
- Runs record the hash in `meta.json` (runner, issue #4).

## Adding a repo

1. Create `repos/<name>/` with its own `.gitignore` and lockfile.
2. Pass the health check and `scripts/check-neutrality.sh`.
3. Add a row to the registry with its hash, and a section describing the
   fictional company, what exists and what deliberately does not.
