import type { TraceStats } from '../lib/parse';

export function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const m = Math.floor(ms / 60_000);
  return `${m} min ${Math.round((ms % 60_000) / 1000)} s`;
}

const fmtK = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function StatTiles({
  stats,
  fileName,
  onReset,
}: {
  stats: TraceStats;
  fileName: string;
  onReset: () => void;
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <p className="sub" style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
          {fileName}
          {stats.model ? ` · ${stats.model}` : ''}
        </p>
        <button className="ghost" onClick={onReset} style={{ padding: '6px 14px' }}>
          Open another
        </button>
      </div>
      <div className="tiles">
        <div className="tile">
          <div className="k">Duration</div>
          <div className="v">{fmtMs(stats.durationMs)}</div>
        </div>
        <div className="tile">
          <div className="k">Turns</div>
          <div className="v">{stats.turns}</div>
        </div>
        <div className="tile">
          <div className="k">Tool calls</div>
          <div className="v">{stats.toolCalls}</div>
        </div>
        <div className={`tile${stats.errors > 0 ? ' bad' : ''}`}>
          <div className="k">Failed calls</div>
          <div className="v">{stats.errors}</div>
        </div>
        <div className="tile">
          <div className="k">Tokens in / out</div>
          <div className="v">
            {fmtK(stats.tokensIn)} <small>/ {fmtK(stats.tokensOut)}</small>
          </div>
        </div>
        {stats.costUsd !== undefined && (
          <div className="tile">
            <div className="k">Est. cost</div>
            <div className="v">
              ${stats.costUsd.toFixed(stats.costUsd < 0.1 ? 3 : 2)} <small>est.</small>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
