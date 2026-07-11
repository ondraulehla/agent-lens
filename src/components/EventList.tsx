import type { Trace } from '../lib/parse';
import type { ColorMap } from '../App';
import { fmtMs } from './StatTiles';

export function EventList({ trace, colors }: { trace: Trace; colors: ColorMap }) {
  const t0 = trace.events[0]?.start ?? 0;
  return (
    <section className="panel events" aria-label="Event inspector">
      <h2>Event inspector</h2>
      <p className="sub">the full sequence — expand any row for its content</p>
      {trace.events.map((event) => (
        <details key={event.id}>
          <summary>
            <span className="dot" style={{ background: colors.colorFor(event) }} />
            <span className="kind">
              {event.kind === 'tool-call' ? event.tool : event.kind}
              {event.isError ? ' ✖' : ''}
            </span>
            <span className="lbl">{event.label}</span>
            <span className="t">{fmtMs(event.start - t0)}</span>
          </summary>
          <pre>{event.detail || '(empty)'}</pre>
        </details>
      ))}
    </section>
  );
}
