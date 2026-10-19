# OpenCode JSON trace format

Observed output of `opencode run --format json` (JSONL: one event per line).

## Environment
| Item | Value |
|---|---|
| OpenCode version | 1.19.3 |
| Docker image | `agent-bench:0.1` |
| Models tested | `opencode/big-pickle` (+ TODO second model) |
| Date of observation | 2026-10-19 |

## Event types observed
Smoke run (`hello.py` prompt), `opencode/big-pickle`:

```
      3 step_finish
      3 step_start
      1 text
      2 tool_use
```

## Common envelope
Every line: `{ "type", "timestamp" (epoch ms), "sessionID", "part": {...} }`.
`sessionID` is constant for the whole run.

## Agent loop
One step = one model call:
`step_start` → (`tool_use` | `text`)* → `step_finish`.
The run ends normally when the last `step_finish` has `reason: "stop"`.

Smoke run sequence:
| Step | Events | `reason` |
|---|---|---|
| 1 | `tool_use` (write `hello.py`) | `tool-calls` |
| 2 | `tool_use` (bash `python3 hello.py`) | `tool-calls` |
| 3 | `text` (final summary) | `stop` |

## Event details

### `step_start`
Start of a loop iteration. No useful payload besides ids.

### `step_finish`
End of a loop iteration.
- `part.reason`: `"tool-calls"` (loop continues) or `"stop"` (agent finished)
- `part.tokens`: `{ total, input, output, reasoning, cache: { read, write } }`
- `part.cost`: `0` for free Zen models

```json
{"type":"step_finish","timestamp":1792422108632,"sessionID":"ses_…","part":{"type":"step-finish","reason":"tool-calls","tokens":{"total":7710,"input":114,"output":33,"reasoning":11,"cache":{"write":0,"read":7552}},"cost":0}}
```

### `tool_use`
A tool call by the agent, emitted once completed.
- `part.tool`: tool name (`write`, `bash` observed)
- `part.callID`: unique call id
- `part.state.status`: `"completed"` observed (TODO: check value on failure)
- `part.state.input`: tool arguments
  - `write`: `{ filePath, content }`
  - `bash`: `{ command, workdir }`
- `part.state.output`: tool result (stdout for bash)
- `part.state.metadata.exit`: shell exit code (bash)
- `part.state.time`: `{ start, end }` in epoch ms

```json
{"type":"tool_use","timestamp":1792422115019,"sessionID":"ses_…","part":{"type":"tool","tool":"bash","callID":"call_…","state":{"status":"completed","input":{"command":"python3 hello.py","workdir":"/app"},"output":"Hello\n","metadata":{"exit":0,"truncated":false},"time":{"start":1792422114715,"end":1792422115012}}}}
```

### `text`
Assistant message text.
- `part.text`: content
- `part.time`: `{ start, end }`

```json
{"type":"text","timestamp":1792422118453,"sessionID":"ses_…","part":{"type":"text","text":"Created `hello.py` and ran it — output: `Hello`."}}
```

## Where to find key information
| Information | Event type | JSON path |
|---|---|---|
| Tool call (name + input) | `tool_use` | `.part.tool`, `.part.state.input` |
| Shell command executed | `tool_use` (bash) | `.part.state.input.command` |
| Package installs | `tool_use` (bash) | `.part.state.input.command` (e.g. `npm install …`) |
| File written | `tool_use` (write) | `.part.state.input.filePath` |
| Assistant text | `text` | `.part.text` |
| Token usage | `step_finish` | `.part.tokens` |
| End of run | last `step_finish` | `.part.reason == "stop"` |

## Metrics notes
- Summing `tokens.total` over steps gives **cumulative tokens processed**
  (cache re-reads counted at every step), not context size.
  Smoke run: 3 steps, 23,252 tokens processed, 46 s wall time.

## Gotchas
- Top-level `type` uses underscores (`step_finish`), `part.type` uses hyphens
  (`step-finish`) or a different name (`tool`): **parse on top-level `type`**.
- `part.snapshot` is OpenCode's internal git snapshot, not the workspace baseline.
- Paths are container paths (`/app/...`).
- Outputs may be truncated: check `metadata.truncated`.

