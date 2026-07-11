/**
 * Parser for AI-agent session transcripts in JSONL form.
 *
 * Primary dialect: Claude Code session files (`~/.claude/projects/…/*.jsonl`),
 * where each line is { type, timestamp, message: { role, content[], usage, model } }.
 * The parser is tolerant: unknown lines are skipped (and counted), generic
 * { role, content } chat dumps also work, timestamps may be missing.
 */

export type EventKind = 'user' | 'assistant-text' | 'thinking' | 'tool-call';

export interface TraceEvent {
  id: string;
  kind: EventKind;
  /** Tool name for tool-call events. */
  tool?: string;
  /** One-line preview shown in lists and tooltips. */
  label: string;
  /** Longer excerpt for the inspector. */
  detail: string;
  start: number;
  end: number;
  tokensIn?: number;
  tokensOut?: number;
  isError?: boolean;
  turn: number;
}

export interface ToolStat {
  name: string;
  calls: number;
  totalMs: number;
  errors: number;
}

export interface TraceStats {
  durationMs: number;
  turns: number;
  toolCalls: number;
  errors: number;
  tokensIn: number;
  tokensOut: number;
  cacheRead: number;
  /** Rough estimate from the model named in the transcript; undefined if no usage present. */
  costUsd?: number;
  model?: string;
  tools: ToolStat[];
}

export interface Trace {
  events: TraceEvent[];
  stats: TraceStats;
  warnings: string[];
}

/** USD per million tokens (input, output) — rough, for orientation only. */
const PRICING: [pattern: RegExp, input: number, output: number][] = [
  [/opus/i, 15, 75],
  [/sonnet/i, 3, 15],
  [/haiku/i, 1, 5],
  [/fable|mythos/i, 25, 100],
  [/gpt|o\d/i, 5, 20],
];

const PREVIEW = 120;
const DETAIL = 1200;

function preview(value: unknown, max = PREVIEW): string {
  let text: string;
  if (typeof value === 'string') text = value;
  else if (value == null) text = '';
  else text = JSON.stringify(value);
  text = text.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function blockText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block) =>
        typeof block === 'string'
          ? block
          : typeof (block as { text?: unknown }).text === 'string'
            ? ((block as { text: string }).text)
            : '',
      )
      .join(' ');
  }
  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseTrace(raw: string): Trace {
  const warnings: string[] = [];
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const line of lines) {
    try {
      const parsed: unknown = JSON.parse(line);
      if (isRecord(parsed)) rows.push(parsed);
      else skipped++;
    } catch {
      skipped++;
    }
  }
  if (skipped > 0) warnings.push(`${skipped} line(s) skipped (not valid JSON objects).`);
  if (rows.length === 0) {
    return {
      events: [],
      warnings: [...warnings, 'No parseable events found — is this a JSONL transcript?'],
      stats: { durationMs: 0, turns: 0, toolCalls: 0, errors: 0, tokensIn: 0, tokensOut: 0, cacheRead: 0, tools: [] },
    };
  }

  // synthetic clock for transcripts without timestamps: 1s per line
  let syntheticMs = Date.parse('2026-01-01T00:00:00Z');
  const timeOf = (row: Record<string, unknown>): number => {
    const ts = row.timestamp ?? row.ts ?? row.time;
    if (typeof ts === 'string') {
      const parsed = Date.parse(ts);
      if (!Number.isNaN(parsed)) return parsed;
    }
    if (typeof ts === 'number') return ts > 1e12 ? ts : ts * 1000;
    return (syntheticMs += 1000);
  };

  const events: TraceEvent[] = [];
  const openCalls = new Map<string, TraceEvent>();
  let turn = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let cacheRead = 0;
  let model: string | undefined;
  let sawUsage = false;
  let counter = 0;
  const nextId = () => `evt-${counter++}`;

  for (const row of rows) {
    const message = isRecord(row.message) ? row.message : row;
    const role = (message.role ?? row.type) as string | undefined;
    if (role !== 'user' && role !== 'assistant') continue;
    const at = timeOf(row);

    const usage = isRecord(message.usage) ? message.usage : undefined;
    if (usage) {
      sawUsage = true;
      tokensIn += Number(usage.input_tokens ?? 0);
      tokensOut += Number(usage.output_tokens ?? 0);
      cacheRead += Number(usage.cache_read_input_tokens ?? 0);
    }
    if (!model && typeof message.model === 'string') model = message.model;

    const content = message.content;
    const blocks: unknown[] = Array.isArray(content) ? content : [{ type: 'text', text: content }];

    let userTextSeen = false;
    for (const rawBlock of blocks) {
      const block = isRecord(rawBlock) ? rawBlock : { type: 'text', text: String(rawBlock ?? '') };
      const type = block.type ?? 'text';

      if (role === 'user' && type === 'tool_result') {
        const call = openCalls.get(String(block.tool_use_id));
        if (call) {
          call.end = at;
          call.isError = block.is_error === true;
          const body = preview(blockText(block.content) || block.content, DETAIL);
          call.detail += body ? `\n\n→ result: ${body}` : '';
          openCalls.delete(String(block.tool_use_id));
        }
        continue;
      }

      if (role === 'user' && type === 'text') {
        const text = blockText([block]);
        if (!text.trim()) continue;
        if (!userTextSeen) {
          turn++;
          userTextSeen = true;
        }
        events.push({
          id: nextId(), kind: 'user', label: preview(text), detail: preview(text, DETAIL),
          start: at, end: at, turn,
        });
        continue;
      }

      if (role !== 'assistant') continue;

      if (type === 'thinking') {
        events.push({
          id: nextId(), kind: 'thinking', label: preview(block.thinking ?? ''), detail: preview(block.thinking ?? '', DETAIL),
          start: at, end: at, turn,
        });
      } else if (type === 'text') {
        const text = blockText([block]);
        if (!text.trim()) continue;
        events.push({
          id: nextId(), kind: 'assistant-text', label: preview(text), detail: preview(text, DETAIL),
          start: at, end: at, turn,
        });
      } else if (type === 'tool_use') {
        const name = typeof block.name === 'string' ? block.name : 'tool';
        const event: TraceEvent = {
          id: nextId(), kind: 'tool-call', tool: name,
          label: `${name}(${preview(block.input, 80)})`,
          detail: preview(block.input, DETAIL),
          start: at, end: at, turn,
        };
        events.push(event);
        if (typeof block.id === 'string') openCalls.set(block.id, event);
      }
    }
  }

  events.sort((a, b) => a.start - b.start);
  const last = events[events.length - 1];
  // close any dangling tool calls at the end of the trace
  for (const call of openCalls.values()) call.end = Math.max(call.end, last?.start ?? call.start);

  const toolMap = new Map<string, ToolStat>();
  let errors = 0;
  for (const event of events) {
    if (event.kind !== 'tool-call') continue;
    const stat = toolMap.get(event.tool!) ?? { name: event.tool!, calls: 0, totalMs: 0, errors: 0 };
    stat.calls++;
    stat.totalMs += event.end - event.start;
    if (event.isError) {
      stat.errors++;
      errors++;
    }
    toolMap.set(event.tool!, stat);
  }
  const tools = [...toolMap.values()].sort((a, b) => b.totalMs - a.totalMs);

  const first = events[0];
  const durationMs = first && last ? Math.max(...events.map((e) => e.end)) - first.start : 0;

  let costUsd: number | undefined;
  if (sawUsage) {
    const [, inRate, outRate] = PRICING.find(([p]) => p.test(model ?? '')) ?? [/./, 3, 15];
    costUsd = (tokensIn / 1e6) * inRate + (tokensOut / 1e6) * outRate;
  }

  if (events.length > 0 && events.every((e) => e.kind !== 'tool-call')) {
    warnings.push('No tool calls found — timeline shows conversation only.');
  }

  return {
    events,
    warnings,
    stats: {
      durationMs, turns: turn, toolCalls: toolMap.size === 0 ? 0 : [...toolMap.values()].reduce((s, t) => s + t.calls, 0),
      errors, tokensIn, tokensOut, cacheRead, tools,
      ...(costUsd !== undefined ? { costUsd } : {}),
      ...(model !== undefined ? { model } : {}),
    },
  };
}
