# agent-lens

**See what your agent actually did.** Drop an AI agent session transcript (JSONL) into the browser and get an instant visual debrief: a timeline of every tool call, where the wall-clock time went, token usage, estimated cost and failed calls.

Agent sessions are long, branching and expensive — and the raw transcript is a wall of JSON. When something was slow, wasteful or silently failing, the evidence is in there, but nobody reads 400 lines of JSONL. agent-lens turns the transcript into something you can *scan*.

## Features

- **Session timeline** — every event (user turns, thinking, assistant text, tool calls) positioned in real session time, colored by tool, failed calls ringed in red; hover any bar for details
- **Where the time went** — per-tool totals: wall-clock time inside the tool, call counts, failure counts
- **Stat tiles** — duration, turns, tool calls, failures, tokens in/out, estimated cost (from the model named in the transcript)
- **Event inspector** — the full sequence with expandable content previews, tool inputs paired with their results
- **100 % client-side** — transcripts often contain code and secrets, so nothing ever leaves your machine; there is no backend
- **Tolerant parser** — Claude Code session files (`~/.claude/projects/<project>/*.jsonl`) first-class, generic `{role, content}` JSONL dumps also work, garbage lines are skipped and reported

## Try it

```bash
npm install
npm run dev      # open http://localhost:5173, hit "Load the demo session"
npm test         # parser test suite
npm run build    # typecheck + production build
```

Then drop one of your own sessions — Claude Code stores them in `~/.claude/projects/<project-dir>/<session-id>.jsonl`.

## How it works

The parser ([src/lib/parse.ts](src/lib/parse.ts)) streams the JSONL line by line, tolerating unknown shapes: it pairs `tool_use` blocks with their `tool_result` by id to measure real tool durations, counts turns from genuine user messages (tool results ride in `user` lines but don't count), accumulates `usage` tokens and estimates cost from the model name. The UI is React; charts are hand-rolled HTML/CSS following a validated, colorblind-safe categorical palette with light and dark modes.

## Roadmap

- Multi-session comparison (A/B of two runs of the same task)
- Subagent tree view for orchestrated sessions
- Cache-efficiency insights (cache-read vs fresh input tokens per turn)
- Shareable redacted exports

## License

MIT © [Ondřej Úlehla](https://github.com/ondraulehla)
