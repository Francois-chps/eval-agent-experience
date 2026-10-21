# agent-tool-choice-bench

[![CI](https://github.com/Francois-chps/eval-agent-experience/actions/workflows/ci.yml/badge.svg)](https://github.com/Francois-chps/eval-agent-experience/actions/workflows/ci.yml)

> Which tools do AI coding agents pick when building real software, and does the way you ask change the answer?

**Status:** 🚧 Work in progress. Pipeline under construction, no results yet.

## Motivation

AI coding agents increasingly decide which libraries and services end up in production code.
This project measures those choices with controlled, reproducible runs of real agents on synthetic
repositories, inspired by [Armature's leaderboards](https://armature.tech/leaderboards).

## Research questions

1. **Tool choice:** Which service/library do agents choose for a given task category? *(category: TBD)*
2. **Persona sensitivity:** Does the prompt persona (vibe coder, junior, senior, enterprise) change the choice?
3. **Stability:** Do repeated runs with different phrasings converge on the same tool?
4. **Mentioned vs. chosen:** Which tools are considered but never picked?
5. **Open vs. frontier models:** Do free/open models recommend the same tools as frontier agents?

## Methodology

| Component | Design |
|---|---|
| **Repositories** | Synthetic codebases mimicking real companies (stack, language, business context) |
| **Prompts** | Persona-based, frozen and versioned in Git |
| **Agents** | Real agent CLIs in non-interactive mode, pinned versions and model IDs |
| **Isolation** | One fresh Docker container per run, same starting state |
| **Capture** | Full JSONL event trace + git diff + run metadata |
| **Judging** | LLM judge with a structured output schema, validated against hand-labeled runs |
| **Analysis** | Win shares with confidence intervals, persona effects, phrasing stability |

All raw data (traces, diffs) is kept so the judge and the analysis can be re-run without re-running agents.

## Project structure (planned)

```
docker/        Agent image (Dockerfile, agent config)
repos/         Synthetic test repositories
prompts/       Persona prompts (frozen)
src/runner/    Run matrix orchestration, resume after interruption
src/adapters/  One adapter per agent → common event format
src/judge/     LLM judge + validation
analysis/      Statistics and results page
docs/          Trace formats, methodology notes, limitations
```

## Setup

Requirements: WSL2 (on Windows), Docker, Node.js 22+.

```bash
cp .env.example .env   # add your API key(s)
docker build -t agent-bench:0.1 .
```

## Roadmap

- [ ] #1 Docker image + first agent run
- [ ] #2 First synthetic repository + persona prompts
- [ ] #3 Runner v0: one end-to-end run (trace, diff, meta)
- [ ] #4 Trace parsers → common event format
- [ ] #5 LLM judge + validation on hand-labeled runs
- [ ] #6 Full matrix with resume
- [ ] #7 Analysis + results page

## Limitations

*Documented as the project progresses: sample size, free-model availability, judge reliability, synthetic repo realism.*

## Runner

See [docs/runner.md](docs/runner.md) for the experiment runner: commands,
preflight checks, workspace and `meta.json` format.
