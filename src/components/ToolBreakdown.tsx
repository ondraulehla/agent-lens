import type { TraceStats } from '../lib/parse';
import type { ColorMap } from '../App';
import { fmtMs } from './StatTiles';

export function ToolBreakdown({ stats, colors }: { stats: TraceStats; colors: ColorMap }) {
  if (stats.tools.length === 0) return null;
  const max = Math.max(...stats.tools.map((t) => t.totalMs), 1);
  return (
    <section className="panel tools" aria-label="Tool breakdown">
      <h2>Where the time went</h2>
      <p className="sub">total wall-clock time inside each tool</p>
      {stats.tools.map((tool) => (
        <div className="row" key={tool.name}>
          <div className="name">{tool.name}</div>
          <div className="track">
            <div
              className="fill"
              style={{ width: `${(tool.totalMs / max) * 100}%`, background: colors.toolColor(tool.name) }}
            />
          </div>
          <div className="val">
            <b>{fmtMs(tool.totalMs)}</b> · {tool.calls}×
            {tool.errors > 0 && (
              <>
                {' '}
                · <span className="err-note">{tool.errors} failed</span>
              </>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
