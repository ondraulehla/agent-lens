import { describe, expect, it } from 'vitest';
import { parseTrace } from '../src/lib/parse';
import { demoTrace } from '../src/lib/demo';

describe('parseTrace — demo session', () => {
  const trace = parseTrace(demoTrace);

  it('counts turns from user text messages only (tool results excluded)', () => {
    expect(trace.stats.turns).toBe(2);
  });

  it('finds all tool calls and pairs them with their results', () => {
    expect(trace.stats.toolCalls).toBe(8);
    const bash = trace.stats.tools.find((t) => t.name === 'Bash');
    expect(bash?.calls).toBe(4);
  });

  it('flags the failed test run as an error', () => {
    expect(trace.stats.errors).toBe(1);
    const failed = trace.events.find((e) => e.isError);
    expect(failed?.tool).toBe('Bash');
  });

  it('measures tool durations from the matching result timestamp', () => {
    const failed = trace.events.find((e) => e.isError)!;
    expect(failed.end - failed.start).toBeGreaterThan(5000);
  });

  it('accumulates token usage and estimates cost from the model', () => {
    expect(trace.stats.tokensIn).toBeGreaterThan(30_000);
    expect(trace.stats.tokensOut).toBeGreaterThan(1_000);
    expect(trace.stats.model).toBe('claude-sonnet-5');
    expect(trace.stats.costUsd).toBeGreaterThan(0);
  });

  it('produces a positive session duration', () => {
    expect(trace.stats.durationMs).toBeGreaterThan(30_000);
  });
});

describe('parseTrace — resilience', () => {
  it('survives garbage lines and reports them', () => {
    const trace = parseTrace('not json\n{"broken":\n' + demoTrace.split('\n')[0]);
    expect(trace.warnings[0]).toMatch(/2 line\(s\) skipped/);
    expect(trace.events).toHaveLength(1);
  });

  it('handles generic {role, content} chat dumps without timestamps', () => {
    const generic = [
      JSON.stringify({ role: 'user', content: 'hello' }),
      JSON.stringify({ role: 'assistant', content: 'hi there' }),
    ].join('\n');
    const trace = parseTrace(generic);
    expect(trace.events).toHaveLength(2);
    expect(trace.stats.turns).toBe(1);
    expect(trace.stats.costUsd).toBeUndefined();
  });

  it('returns a helpful warning for empty input', () => {
    const trace = parseTrace('');
    expect(trace.events).toHaveLength(0);
    expect(trace.warnings.join(' ')).toMatch(/No parseable events/);
  });

  it('closes dangling tool calls at the end of the trace', () => {
    const dangling = [
      JSON.stringify({ type: 'user', timestamp: '2026-01-01T00:00:00Z', message: { role: 'user', content: [{ type: 'text', text: 'go' }] } }),
      JSON.stringify({ type: 'assistant', timestamp: '2026-01-01T00:00:05Z', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'x', name: 'Bash', input: {} }] } }),
    ].join('\n');
    const trace = parseTrace(dangling);
    const call = trace.events.find((e) => e.kind === 'tool-call')!;
    expect(call.end).toBeGreaterThanOrEqual(call.start);
  });
});
