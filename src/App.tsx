import { useCallback, useMemo, useState } from 'react';
import { parseTrace, type Trace, type TraceEvent } from './lib/parse';
import { demoTrace } from './lib/demo';
import { StatTiles } from './components/StatTiles';
import { Timeline } from './components/Timeline';
import { ToolBreakdown } from './components/ToolBreakdown';
import { EventList } from './components/EventList';
import { Tooltip, type TooltipState } from './components/Tooltip';

/** Fixed categorical slot order (validated palette); entities keep their slot. */
const SLOTS = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6', '--series-7', '--series-8'] as const;

export interface ColorMap {
  colorFor(event: TraceEvent): string;
  toolColor(tool: string): string;
  legend: { label: string; varName: string }[];
}

function buildColors(trace: Trace): ColorMap {
  // slot 1 = conversation (user/assistant), slot 2+ = tools by first appearance
  const toolSlots = new Map<string, string>();
  for (const event of trace.events) {
    if (event.kind === 'tool-call' && !toolSlots.has(event.tool!)) {
      const index = toolSlots.size + 1; // slots 2..8
      toolSlots.set(event.tool!, index < SLOTS.length ? SLOTS[index]! : '--text-muted');
    }
  }
  const toolColor = (tool: string) => `var(${toolSlots.get(tool) ?? '--text-muted'})`;
  return {
    toolColor,
    colorFor: (event) =>
      event.kind === 'tool-call'
        ? toolColor(event.tool!)
        : event.kind === 'thinking'
          ? 'var(--baseline)'
          : 'var(--series-1)',
    legend: [
      { label: 'conversation', varName: '--series-1' },
      { label: 'thinking', varName: '--baseline' },
      ...[...toolSlots.entries()].map(([tool, slot]) => ({ label: tool, varName: slot })),
    ],
  };
}

export default function App() {
  const [trace, setTrace] = useState<Trace | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [over, setOver] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const load = useCallback((text: string, name: string) => {
    setTrace(parseTrace(text));
    setFileName(name);
  }, []);

  const onFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      void file.text().then((text) => load(text, file.name));
    },
    [load],
  );

  const colors = useMemo(() => (trace ? buildColors(trace) : null), [trace]);

  return (
    <div
      className="shell"
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
    >
      <header className="top">
        <div className="brand">
          agent-lens<span>.</span>
        </div>
        <div className="tagline">see what your agent actually did</div>
      </header>

      {!trace || !colors ? (
        <section className={`dropzone${over ? ' over' : ''}`}>
          <h1>Drop an agent session here</h1>
          <p>
            A Claude Code transcript (<code>.jsonl</code>) or any JSONL chat dump. Parsed entirely in
            your browser — nothing is uploaded anywhere.
          </p>
          <div className="actions">
            <label className="primary">
              Open a file
              <input type="file" accept=".jsonl,.json,.txt" hidden onChange={(e) => onFiles(e.target.files)} />
            </label>
            <button className="ghost" onClick={() => load(demoTrace, 'demo-session.jsonl')}>
              Load the demo session
            </button>
          </div>
          <p className="hint">
            Claude Code sessions live in <code>~/.claude/projects/&lt;project&gt;/*.jsonl</code>
          </p>
        </section>
      ) : (
        <>
          <StatTiles stats={trace.stats} fileName={fileName} onReset={() => setTrace(null)} />
          {trace.warnings.length > 0 && (
            <p className="warnings">{trace.warnings.join(' ')}</p>
          )}
          <Timeline trace={trace} colors={colors} setTooltip={setTooltip} />
          <ToolBreakdown stats={trace.stats} colors={colors} />
          <EventList trace={trace} colors={colors} />
        </>
      )}

      <Tooltip state={tooltip} />
      <footer className="foot">
        Client-side only · <a href="https://github.com/ondraulehla/agent-lens">source on GitHub</a> · built by{' '}
        <a href="https://github.com/ondraulehla">Ondřej Úlehla</a>
      </footer>
    </div>
  );
}
