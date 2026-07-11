import type { Trace, TraceEvent } from '../lib/parse';
import type { ColorMap } from '../App';
import type { TooltipState } from './Tooltip';
import { fmtMs } from './StatTiles';

const KIND_LABEL: Record<TraceEvent['kind'], string> = {
  user: 'user',
  'assistant-text': 'assistant',
  thinking: 'thinking',
  'tool-call': 'tool call',
};

export function Timeline({
  trace,
  colors,
  setTooltip,
}: {
  trace: Trace;
  colors: ColorMap;
  setTooltip: (t: TooltipState | null) => void;
}) {
  const t0 = trace.events[0]?.start ?? 0;
  const total = Math.max(trace.stats.durationMs, 1);

  const show = (event: TraceEvent) => (e: React.MouseEvent) => {
    const duration = event.end - event.start;
    setTooltip({
      x: e.clientX,
      y: e.clientY,
      title: event.kind === 'tool-call' ? `${event.tool}${event.isError ? ' — failed' : ''}` : KIND_LABEL[event.kind],
      body: event.label,
      meta: `at ${fmtMs(event.start - t0)}${duration > 0 ? ` · took ${fmtMs(duration)}` : ''} · turn ${event.turn}`,
    });
  };

  let previousTurn = 0;
  return (
    <section className="panel" aria-label="Session timeline">
      <h2>Timeline</h2>
      <p className="sub">every event positioned in session time — hover for details</p>
      <div className="legend">
        {colors.legend.map((item) => (
          <span className="item" key={item.label}>
            <span className="swatch" style={{ background: `var(${item.varName})` }} />
            {item.label}
          </span>
        ))}
        <span className="item">
          <span className="swatch" style={{ background: 'none', outline: '2px solid var(--critical)', outlineOffset: -1 }} />
          failed call
        </span>
      </div>

      <div className="timeline">
        {trace.events.map((event) => {
          const isNewTurn = event.turn !== previousTurn;
          previousTurn = event.turn;
          const left = ((event.start - t0) / total) * 100;
          const width = Math.max(((event.end - event.start) / total) * 100, 0.6);
          return (
            <div className={`lane${isNewTurn ? ' turn-sep' : ''}`} key={event.id}>
              <div className="who">
                {event.kind === 'tool-call' ? event.tool : KIND_LABEL[event.kind]}
              </div>
              <div className="track">
                <div
                  className={`bar${event.isError ? ' err' : ''}`}
                  style={{ left: `${left}%`, width: `${width}%`, background: colors.colorFor(event) }}
                  onMouseMove={show(event)}
                  onMouseLeave={() => setTooltip(null)}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="axis">
        <span>0</span>
        <span>{fmtMs(total / 2)}</span>
        <span>{fmtMs(total)}</span>
      </div>
    </section>
  );
}
